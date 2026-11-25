import test from "node:test";
import assert from "node:assert/strict";
import { PUBSUB_CHANNELS, createRedisBus } from "@cvm/shared";
import { createApp } from "../src/app.js";

function createFakeRedis() {
  const lists = new Map();
  const published = [];
  const listeners = [];

  return {
    _lists: lists,
    _published: published,
    async lpush(key, value) {
      const list = lists.get(key) || [];
      list.unshift(String(value));
      lists.set(key, list);
      return list.length;
    },
    async publish(channel, message) {
      published.push({ channel, payload: JSON.parse(message) });
      return 1;
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

function createTransactionalStores() {
  const apps = new Map();
  const outbox = new Map();
  const mirrors = new Map();
  let appSeq = 1;
  let outboxSeq = 1;

  function wrap(store, raw) {
    if (!raw) return null;
    return {
      ...raw,
      async save() {
        const { save: _ignore, ...plain } = this;
        plain.updatedAt = new Date();
        Object.assign(raw, plain);
        store.set(String(raw._id), raw);
        return this;
      },
    };
  }

  async function runInTransaction(fn) {
    const snapshot = {
      apps: structuredClone(apps),
      outbox: structuredClone(outbox),
    };
    try {
      return await fn({ id: "tx-session" });
    } catch (err) {
      apps.clear();
      for (const [k, v] of snapshot.apps) apps.set(k, v);
      outbox.clear();
      for (const [k, v] of snapshot.outbox) outbox.set(k, v);
      throw err;
    }
  }

  const ApplicationModel = {
    _docs: apps,
    async create(payload) {
      const id = `app-${appSeq++}`;
      const raw = {
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...payload,
        _id: id,
      };
      apps.set(id, raw);
      return wrap(apps, raw);
    },
    async findById(id) {
      return wrap(apps, apps.get(String(id)) || null);
    },
    async findOne(filter = {}) {
      for (const raw of apps.values()) {
        if (filter.jobId && String(raw.jobId) !== String(filter.jobId)) continue;
        if (filter.resumeId && String(raw.resumeId) !== String(filter.resumeId)) continue;
        if (filter.status?.$ne && raw.status === filter.status.$ne) continue;
        if (filter.recruiterId && String(raw.recruiterId) !== String(filter.recruiterId)) continue;
        if (filter.candidateId && String(raw.candidateId) !== String(filter.candidateId)) continue;
        return wrap(apps, raw);
      }
      return null;
    },
    async find(filter = {}) {
      const list = [];
      for (const raw of apps.values()) {
        if (filter._id?.$in && !filter._id.$in.includes(String(raw._id))) continue;
        if (filter.jobId && String(raw.jobId) !== String(filter.jobId)) continue;
        if (filter.candidateId && String(raw.candidateId) !== String(filter.candidateId)) continue;
        list.push(wrap(apps, raw));
      }
      return list;
    },
    async countDocuments(filter = {}) {
      return (await this.find(filter)).length;
    },
    async findOneAndUpdate(filter, update) {
      const raw = apps.get(String(filter._id));
      if (!raw) return null;
      if (filter.__v !== undefined && Number(raw.__v) !== Number(filter.__v)) {
        return null;
      }
      if (update.$set) Object.assign(raw, update.$set);
      if (update.$inc?.__v) raw.__v = Number(raw.__v || 0) + Number(update.$inc.__v);
      if (update.$push?.statusHistory) {
        raw.statusHistory = [...(raw.statusHistory || []), update.$push.statusHistory];
      }
      raw.updatedAt = new Date();
      return wrap(apps, raw);
    },
    async bulkWrite(ops = []) {
      let modifiedCount = 0;
      for (const op of ops) {
        if (op.updateOne) {
          const updated = await this.findOneAndUpdate(op.updateOne.filter, op.updateOne.update);
          if (updated) modifiedCount += 1;
        }
      }
      return { modifiedCount };
    },
  };

  let failOutboxCreate = false;
  const OutboxEventModel = {
    _docs: outbox,
    setFailCreate(val) {
      failOutboxCreate = val;
    },
    async create(payload) {
      if (failOutboxCreate) {
        throw new Error("Simulated Outbox DB failure");
      }
      const id = `outbox-${outboxSeq++}`;
      const raw = { createdAt: new Date(), updatedAt: new Date(), attempts: 0, ...payload, _id: id };
      outbox.set(id, raw);
      return wrap(outbox, raw);
    },
    async insertMany(docs = []) {
      const created = [];
      for (const doc of docs) {
        created.push(await this.create(doc));
      }
      return created;
    },
    async find(filter = {}) {
      const list = [];
      for (const raw of outbox.values()) {
        if (filter.status && raw.status !== filter.status) continue;
        list.push(wrap(outbox, raw));
      }
      return list;
    },
  };

  const JobStatusMirrorModel = {
    _docs: mirrors,
    async findOne(filter = {}) {
      return mirrors.get(String(filter.jobId)) || null;
    },
    async findOneAndUpdate(filter, update) {
      const jobId = String(filter.jobId);
      const next = { ...(mirrors.get(jobId) || {}), ...(update.$set || {}), jobId };
      mirrors.set(jobId, next);
      return next;
    },
  };

  return { ApplicationModel, OutboxEventModel, JobStatusMirrorModel, runInTransaction };
}

function listenApp(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

test("Application service implements Outbox ACID, JobStatusMirror, Partial Unique Index, State Machine, OCC 409, and BulkWrite 500", async (t) => {
  const fakeRedis = createFakeRedis();
  const redisBus = createRedisBus(fakeRedis);
  const stores = createTransactionalStores();

  const app = createApp({
    ApplicationModel: stores.ApplicationModel,
    OutboxEventModel: stores.OutboxEventModel,
    JobStatusMirrorModel: stores.JobStatusMirrorModel,
    redisClient: fakeRedis,
    subscriberClient: fakeRedis,
    redisBus,
    runInTransaction: stores.runInTransaction,
    gatewaySecret: "gw-secret",
    internalToken: "worker-secret",
  });

  const { server, baseUrl } = await listenApp(app);
  t.after(() => server.close());

  const candHeaders = {
    "x-gateway-secret": "gw-secret",
    "x-user-id": "cand-1",
    "x-user-role": "candidate",
    "Content-Type": "application/json",
  };
  const recHeaders = {
    "x-gateway-secret": "gw-secret",
    "x-user-id": "rec-1",
    "x-user-role": "recruiter",
    "Content-Type": "application/json",
  };

  // 1. Transaction rollback when Outbox write fails -> zero orphaned Applications
  stores.OutboxEventModel.setFailCreate(true);
  const failedSubmit = await fetch(`${baseUrl}/api/applications`, {
    method: "POST",
    headers: candHeaders,
    body: JSON.stringify({ job_id: "job-1", resume_id: "res-1" }),
  });
  assert.equal(failedSubmit.status, 500);
  assert.equal(stores.ApplicationModel._docs.size, 0);
  stores.OutboxEventModel.setFailCreate(false);

  // 2. Transactional Outbox submit succeeds in < 150ms & Outbox Publisher dispatches to Redis
  const t0 = Date.now();
  const submitResp = await fetch(`${baseUrl}/api/applications`, {
    method: "POST",
    headers: candHeaders,
    body: JSON.stringify({ job_id: "job-1", resume_id: "res-1" }),
  });
  const submitMs = Date.now() - t0;
  assert.equal(submitResp.status, 201);
  assert.ok(submitMs < 150, `Expected Phase 1 submit < 150ms, got ${submitMs}ms`);
  const submitted = await submitResp.json();
  assert.equal(submitted.status, "new");
  assert.equal(submitted.ai_status, "pending");
  assert.equal(stores.OutboxEventModel._docs.size, 1);

  const pubResult = await app.locals.outboxPublisher.publishPendingOnce();
  assert.equal(pubResult.published, 1);
  assert.equal((fakeRedis._lists.get("application_scoring_queue") || []).length, 1);

  // 3. Duplicate active submit returns 409; after withdraw, re-apply succeeds (Partial Unique Index)
  const dupResp = await fetch(`${baseUrl}/api/applications`, {
    method: "POST",
    headers: candHeaders,
    body: JSON.stringify({ job_id: "job-1", resume_id: "res-1" }),
  });
  assert.equal(dupResp.status, 409);

  // 4. Concurrent OCC Conflict: Candidate withdraw vs Recruiter status transition with same __v=0
  const [withdrawRes, screenRes] = await Promise.all([
    fetch(`${baseUrl}/api/applications/${submitted.application_id}/withdraw`, {
      method: "POST",
      headers: candHeaders,
      body: JSON.stringify({ __v: 0, reason: "Found another offer" }),
    }),
    fetch(`${baseUrl}/api/applications/${submitted.application_id}/status`, {
      method: "PATCH",
      headers: recHeaders,
      body: JSON.stringify({ status: "screening", __v: 0 }),
    }),
  ]);
  const statuses = [withdrawRes.status, screenRes.status].sort((a, b) => a - b);
  assert.deepEqual(statuses, [200, 409]);

  // Re-apply only if withdrawn won; test re-apply explicitly on a withdrawn app
  const sub2 = await (
    await fetch(`${baseUrl}/api/applications`, {
      method: "POST",
      headers: candHeaders,
      body: JSON.stringify({ job_id: "job-2", resume_id: "res-2" }),
    })
  ).json();
  const w2 = await fetch(`${baseUrl}/api/applications/${sub2.application_id}/withdraw`, {
    method: "POST",
    headers: candHeaders,
    body: JSON.stringify({ __v: 0 }),
  });
  assert.equal(w2.status, 200);
  // Terminal state immutable check: withdrawn -> screening blocked 409
  const revWithdrawn = await fetch(`${baseUrl}/api/applications/${sub2.application_id}/status`, {
    method: "PATCH",
    headers: recHeaders,
    body: JSON.stringify({ status: "screening" }),
  });
  assert.equal(revWithdrawn.status, 409);
  // Re-apply with same (job-2, res-2) succeeds 201!
  const reapply = await fetch(`${baseUrl}/api/applications`, {
    method: "POST",
    headers: candHeaders,
    body: JSON.stringify({ job_id: "job-2", resume_id: "res-2" }),
  });
  assert.equal(reapply.status, 201);
  const reapplyData = await reapply.json();

  // 5. State machine: illegal jump new -> hired blocked (409)
  const illegalJump = await fetch(`${baseUrl}/api/applications/${reapplyData.application_id}/status`, {
    method: "PATCH",
    headers: recHeaders,
    body: JSON.stringify({ status: "hired" }),
  });
  assert.equal(illegalJump.status, 409);

  // Mark failed -> MANUAL_SCREENING allowed & retry-scoring resets pending
  const failMark = await fetch(`${baseUrl}/api/internal/applications/${reapplyData.application_id}/mark-failed`, {
    method: "POST",
    headers: { "x-internal-token": "worker-secret", "Content-Type": "application/json" },
    body: JSON.stringify({ error: "Qdrant down" }),
  });
  assert.equal(failMark.status, 200);

  const retryScoring = await fetch(`${baseUrl}/api/applications/${reapplyData.application_id}/retry-scoring`, {
    method: "POST",
    headers: recHeaders,
  });
  assert.equal(retryScoring.status, 200);
  assert.equal((await retryScoring.json()).application.aiStatus, "pending");

  // Internal process-ai calculates 0.65/0.35 hybrid score and emits APPLICATION_SCORED
  const scoredResp = await fetch(`${baseUrl}/api/internal/applications/${reapplyData.application_id}/process-ai`, {
    method: "POST",
    headers: { "x-internal-token": "worker-secret", "Content-Type": "application/json" },
    body: JSON.stringify({
      semantic_weight: 0.65,
      mock_scoring_result: {
        semanticScore: 0.8,
        keywordScore: 0.6,
        matchedKeywords: ["node", "redis"],
        missingKeywords: ["docker"],
      },
    }),
  });
  assert.equal(scoredResp.status, 200);
  const scoredBody = await scoredResp.json();
  assert.equal(scoredBody.data.ai_status, "completed");
  assert.equal(scoredBody.data.scores.hybridScore, 0.73);
  assert.ok(fakeRedis._published.some((e) => e.channel === PUBSUB_CHANNELS.APPLICATION_SCORED));

  // 6. Event-Carried State Transfer: JOB_STATUS_CHANGED (closed) blocks new submissions locally
  fakeRedis.emitMessage(PUBSUB_CHANNELS.JOB_STATUS_CHANGED, {
    jobId: "job-closed",
    status: "closed",
  });
  const closedSubmit = await fetch(`${baseUrl}/api/applications`, {
    method: "POST",
    headers: candHeaders,
    body: JSON.stringify({ job_id: "job-closed", resume_id: "res-1" }),
  });
  assert.equal(closedSubmit.status, 400);
  assert.equal((await closedSubmit.json()).error_code, "job_not_accepting_applications");

  // 7. Bulk status update of 500 applications in < 1.0s
  const bulkIds = [];
  for (let i = 0; i < 500; i += 1) {
    const doc = await stores.ApplicationModel.create({
      candidateId: `cand-bulk-${i}`,
      jobId: "job-bulk",
      resumeId: `res-bulk-${i}`,
      status: "new",
      aiStatus: "completed",
      statusHistory: [],
    });
    bulkIds.push(String(doc._id));
  }

  const bulkResp = await fetch(`${baseUrl}/api/applications/bulk-status`, {
    method: "POST",
    headers: recHeaders,
    body: JSON.stringify({ application_ids: bulkIds, status: "screening" }),
  });
  assert.equal(bulkResp.status, 200);
  const bulkResult = await bulkResp.json();
  assert.equal(bulkResult.updatedCount, 500);
  assert.ok(bulkResult.durationMs < 1000, `Expected 500 bulkWrite < 1000ms, got ${bulkResult.durationMs}ms`);
});
