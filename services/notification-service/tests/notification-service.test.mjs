import test from "node:test";
import assert from "node:assert/strict";
import { PUBSUB_CHANNELS } from "@cvm/shared";
import { createApp } from "../src/app.js";

function createFakeRedis() {
  const lists = new Map();
  const listeners = [];

  return {
    _lists: lists,
    async lpush(key, value) {
      const list = lists.get(key) || [];
      list.unshift(String(value));
      lists.set(key, list);
      return list.length;
    },
    async subscribe() {
      return 1;
    },
    on(event, cb) {
      if (event === "message") listeners.push(cb);
    },
    emitMessage(channel, payload) {
      const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
      for (const cb of listeners) cb(channel, raw);
    },
  };
}

function createInMemoryNotificationStore() {
  const docs = new Map();
  let seq = 1;

  function wrap(raw) {
    if (!raw) return null;
    return {
      ...raw,
      async save() {
        const { save: _ignore, ...plain } = this;
        plain.updatedAt = new Date();
        Object.assign(raw, plain);
        docs.set(String(raw._id), raw);
        return this;
      },
    };
  }

  return {
    _docs: docs,
    async create(payload) {
      for (const existing of docs.values()) {
        if (existing.idempotencyKey === payload.idempotencyKey) {
          const err = new Error("Duplicate idempotencyKey");
          err.code = 11000;
          throw err;
        }
      }
      const id = `notif-${seq++}`;
      const raw = {
        readAt: null,
        emailSent: false,
        createdAt: new Date(Date.now() + seq * 10),
        updatedAt: new Date(),
        ...payload,
        _id: id,
      };
      docs.set(id, raw);
      return wrap(raw);
    },
    async findOne(filter = {}) {
      for (const raw of docs.values()) {
        if (filter.idempotencyKey && raw.idempotencyKey === filter.idempotencyKey) {
          return wrap(raw);
        }
      }
      return null;
    },
    async findById(id) {
      return wrap(docs.get(String(id)) || null);
    },
    async find(filter = {}, optsOrProj = {}, maybeOpts = {}) {
      const opts = (optsOrProj && typeof optsOrProj === "object" ? optsOrProj : maybeOpts) || {};
      let list = [];
      for (const raw of docs.values()) {
        if (filter.userId && String(raw.userId) !== String(filter.userId)) continue;
        if (filter.createdAt?.$gt && !(raw.createdAt > filter.createdAt.$gt)) continue;
        list.push(wrap(raw));
      }
      if (opts.sort?.createdAt === -1) {
        list.sort((a, b) => b.createdAt - a.createdAt);
      } else if (opts.sort?.createdAt === 1) {
        list.sort((a, b) => a.createdAt - b.createdAt);
      }
      if (opts.limit) list = list.slice(0, opts.limit);
      return list;
    },
    async countDocuments(filter = {}) {
      let count = 0;
      for (const raw of docs.values()) {
        if (filter.userId && String(raw.userId) !== String(filter.userId)) continue;
        if (filter.readAt === null && raw.readAt !== null) continue;
        count += 1;
      }
      return count;
    },
    async updateMany(filter = {}, update = {}) {
      for (const raw of docs.values()) {
        if (filter.userId && String(raw.userId) !== String(filter.userId)) continue;
        if (filter.readAt === null && raw.readAt !== null) continue;
        if (update.$set) Object.assign(raw, update.$set);
      }
    },
  };
}

function listenApp(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

test("Notification service delivers real-time SSE (< 500ms), deduplicates by idempotencyKey, and replays Last-Event-ID", async (t) => {
  const fakeRedis = createFakeRedis();
  const NotificationModel = createInMemoryNotificationStore();

  const app = createApp({
    NotificationModel,
    redisClient: fakeRedis,
    subscriberClient: fakeRedis,
    heartbeatMs: 25000,
    gatewaySecret: "gw-secret",
    internalToken: "worker-secret",
  });

  const { server, baseUrl } = await listenApp(app);
  t.after(() => {
    app.locals.sseHub.closeAll();
    server.close();
  });

  const candHeaders = {
    "x-gateway-secret": "gw-secret",
    "x-user-id": "cand-1",
    "x-user-role": "candidate",
  };

  // 1. Open SSE connection for cand-1
  const ac1 = new AbortController();
  const sseResp1 = await fetch(`${baseUrl}/api/notifications/stream`, {
    headers: candHeaders,
    signal: ac1.signal,
  });
  assert.equal(sseResp1.status, 200);
  const reader1 = sseResp1.body.getReader();
  const decoder = new TextDecoder();

  // Read initial ": connected\n\n"
  const firstChunk = await reader1.read();
  assert.ok(decoder.decode(firstChunk.value).includes(": connected"));

  // Emit APPLICATION_STATUS_CHANGED (to_status: "interview") -> expect SSE push < 500ms
  const t0 = Date.now();
  fakeRedis.emitMessage(PUBSUB_CHANNELS.APPLICATION_STATUS_CHANGED, {
    application_id: "app-1",
    candidate_id: "cand-1",
    candidate_email: "cand1@example.com",
    from_status: "screening",
    to_status: "interview",
    changed_at: "2026-11-24T10:00:00Z",
  });

  const eventChunk = await reader1.read();
  const elapsed = Date.now() - t0;
  const eventText = decoder.decode(eventChunk.value);
  assert.ok(elapsed < 500, `Expected SSE push < 500ms, got ${elapsed}ms`);
  assert.ok(eventText.includes("event: notification"));
  assert.ok(eventText.includes("interview"));
  assert.equal((fakeRedis._lists.get("notification_queue") || []).length, 1);

  // Extract id: notif-1 for Last-Event-ID replay test
  const idMatch = eventText.match(/^id:\s*(.+)$/m);
  const firstNotifId = idMatch ? idMatch[1].trim() : "notif-1";

  ac1.abort();
  await reader1.cancel().catch(() => {});

  // 2. Duplicate event with same idempotencyKey is deduplicated
  fakeRedis.emitMessage(PUBSUB_CHANNELS.APPLICATION_STATUS_CHANGED, {
    application_id: "app-1",
    candidate_id: "cand-1",
    from_status: "screening",
    to_status: "interview",
    changed_at: "2026-11-24T10:00:00Z",
  });
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(NotificationModel._docs.size, 1);
  assert.equal((fakeRedis._lists.get("notification_queue") || []).length, 1);

  // 3. Emit a second notification while client is disconnected, then reconnect with Last-Event-ID
  fakeRedis.emitMessage(PUBSUB_CHANNELS.APPLICATION_SCORED, {
    application_id: "app-2",
    candidate_id: "cand-1",
    scores: { hybridScore: 0.85 },
    published_at: "2026-11-24T10:05:00Z",
  });
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(NotificationModel._docs.size, 2);

  const ac2 = new AbortController();
  const sseResp2 = await fetch(`${baseUrl}/api/notifications/stream`, {
    headers: { ...candHeaders, "Last-Event-ID": firstNotifId },
    signal: ac2.signal,
  });
  assert.equal(sseResp2.status, 200);
  const reader2 = sseResp2.body.getReader();

  let replayBuffer = "";
  for (let i = 0; i < 3; i += 1) {
    const chunk = await reader2.read();
    if (chunk.done) break;
    replayBuffer += decoder.decode(chunk.value);
    if (replayBuffer.includes("ai_scoring_completed")) break;
  }
  assert.ok(replayBuffer.includes("ai_scoring_completed"));
  ac2.abort();
  await reader2.cancel().catch(() => {});

  // 4. Unread count, mark-read, and internal email-sent callback
  const unread = await (await fetch(`${baseUrl}/api/notifications/unread-count`, { headers: candHeaders })).json();
  assert.equal(unread.unread_count, 2);

  const markOne = await fetch(`${baseUrl}/api/notifications/${firstNotifId}/read`, {
    method: "PATCH",
    headers: candHeaders,
  });
  assert.equal(markOne.status, 200);

  const emailSent = await fetch(`${baseUrl}/internal/notifications/${firstNotifId}/email-sent`, {
    method: "POST",
    headers: { "x-internal-token": "worker-secret" },
  });
  assert.equal(emailSent.status, 200);
  assert.equal((await emailSent.json()).notification.emailSent, true);
});
