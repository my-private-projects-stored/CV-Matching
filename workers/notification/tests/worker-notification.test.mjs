import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNotificationWorkerConfig,
  processNotificationQueueOnce,
  recoverStuckNotificationMessages,
} from "../worker-core.js";

function createFakeRedis() {
  const lists = new Map();
  const hashes = new Map();

  function getList(key) {
    if (!lists.has(key)) lists.set(key, []);
    return lists.get(key);
  }

  function getHash(key) {
    if (!hashes.has(key)) hashes.set(key, new Map());
    return hashes.get(key);
  }

  return {
    _lists: lists,
    async lpush(key, val) {
      const list = getList(key);
      list.unshift(String(val));
      return list.length;
    },
    async rpush(key, val) {
      const list = getList(key);
      list.push(String(val));
      return list.length;
    },
    async blmove(src, dst, srcSide, dstSide) {
      const s = getList(src);
      if (s.length === 0) return null;
      const item = srcSide === "RIGHT" ? s.pop() : s.shift();
      const d = getList(dst);
      if (dstSide === "LEFT") d.unshift(item);
      else d.push(item);
      return item;
    },
    async lrem(key, count, value) {
      const list = getList(key);
      let removed = 0;
      const next = [];
      for (const item of list) {
        if (item === value && (count === 0 || removed < count)) {
          removed += 1;
          continue;
        }
        next.push(item);
      }
      lists.set(key, next);
      return removed;
    },
    async lrange(key, start, stop) {
      const list = getList(key);
      const end = stop < 0 ? list.length + 1 + stop : stop + 1;
      return list.slice(start, end);
    },
    async hset(key, field, value) {
      getHash(key).set(field, String(value));
      return 1;
    },
    async hgetall(key) {
      return Object.fromEntries(getHash(key).entries());
    },
    async hdel(key, field) {
      return getHash(key).delete(field) ? 1 : 0;
    },
  };
}

test("Notification worker uses BLMOVE, renders self-contained emails without DB coupling, recovers stuck tasks, and DLQs", async () => {
  const redis = createFakeRedis();
  const config = buildNotificationWorkerConfig({
    NOTIFICATION_QUEUE_NAME: "notification_queue",
    NOTIFICATION_INTERNAL_BASE_URL: "http://notification-service:5007/internal",
    WORKER_INTERNAL_TOKEN: "tok-notif",
    NOTIFICATION_MAX_RETRIES: "3",
    NOTIFICATION_VISIBILITY_TIMEOUT_MS: "50",
  });

  const sentEmails = [];
  const callbacks = [];
  let failSmtp = false;

  const sendEmailImpl = async (msg) => {
    if (failSmtp) return { delivered: false, reason: "smtp_error", error: "SMTP 503" };
    sentEmails.push(msg);
    return { delivered: true, messageId: "msg-1" };
  };

  const fetchImpl = async (url, init) => {
    callbacks.push({ url, headers: init.headers });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  // 1. Self-contained payload -> BLMOVE -> SMTP -> internal email-sent callback -> LREM
  await redis.lpush(
    config.queueName,
    JSON.stringify({
      notification_id: "notif-1",
      type: "application_status_changed",
      application_id: "app-1",
      recipient_email: "cand1@example.com",
      recipient_name: "Alice",
      job_title: "Backend Engineer",
      from_status: "screening",
      to_status: "interview",
      retry_count: 0,
    })
  );

  const res1 = await processNotificationQueueOnce(redis, config, { sendEmailImpl, fetchImpl });
  assert.equal(res1.status, "processed");
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, "cand1@example.com");
  assert.equal(callbacks.length, 1);
  assert.ok(callbacks[0].url.endsWith("/notifications/notif-1/email-sent"));
  assert.equal((redis._lists.get(config.processingQueueName) || []).length, 0);

  // 2. Crash recovery for stuck message in processing_queue
  const stuck = JSON.stringify({
    notification_id: "notif-2",
    type: "ai_scoring_completed",
    application_id: "app-2",
    recipient_email: "cand2@example.com",
    recipient_name: "Bob",
    job_title: "Frontend Engineer",
    ai_scores: { semanticScore: 0.9, keywordScore: 0.7, hybridScore: 0.83 },
    retry_count: 0,
  });
  await redis.lpush(config.processingQueueName, stuck);
  await redis.hset(config.processingTimestampsKey, stuck, String(Date.now() - 1000));

  const rec = await recoverStuckNotificationMessages(redis, config, Date.now(), console);
  assert.equal(rec.recovered, 1);

  const res2 = await processNotificationQueueOnce(redis, config, { sendEmailImpl, fetchImpl });
  assert.equal(res2.status, "processed");
  assert.equal(sentEmails.length, 2);

  // 3. DLQ after 3 failed retries
  failSmtp = true;
  await redis.lpush(
    config.queueName,
    JSON.stringify({
      notification_id: "notif-3",
      type: "job_closed",
      recipient_email: "cand3@example.com",
      job_title: "QA",
      retry_count: 3,
    })
  );
  const resDlq = await processNotificationQueueOnce(redis, config, { sendEmailImpl, fetchImpl });
  assert.equal(resDlq.status, "dead-letter");
  assert.equal((redis._lists.get(config.deadLetterQueueName) || []).length, 1);
});
