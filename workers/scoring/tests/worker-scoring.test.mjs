import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWorkerConfig,
  createWeightState,
  processQueueMessageOnce,
  recoverStuckProcessingMessages,
} from "../worker-core.js";

function createFakeRedis() {
  const lists = new Map();
  const hashes = new Map();
  const published = [];

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
    _published: published,
    async lpush(key, value) {
      const list = getList(key);
      list.unshift(String(value));
      return list.length;
    },
    async rpush(key, value) {
      const list = getList(key);
      list.push(String(value));
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
    async publish(channel, message) {
      published.push({ channel, payload: JSON.parse(message) });
      return 1;
    },
  };
}

test("Scoring worker uses BLMOVE + LREM, crash recovery, DLQ mark-failed, and hot CONFIG_UPDATED weights", async () => {
  const redis = createFakeRedis();
  const config = buildWorkerConfig({
    SCORING_QUEUE_NAME: "application_scoring_queue",
    BACKEND_INTERNAL_BASE_URL: "http://app-svc:5004/api/internal",
    WORKER_INTERNAL_TOKEN: "tok-1",
    SCORING_QUEUE_MAX_RETRIES: "3",
    SCORING_VISIBILITY_TIMEOUT_MS: "50",
  });
  const weightState = createWeightState(config.semanticWeight);

  const calls = [];
  let failMode = false;
  const mockFetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body });
    if (failMode) {
      return new Response("Worker error", { status: 500 });
    }
    return new Response(
      JSON.stringify({ data: { application_id: "app-1", ai_status: "completed", scores: { hybridScore: 0.78 } } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  // 1. BLMOVE moves task to processing_queue, processes with 0.65/0.35, emits APPLICATION_SCORED, LREM cleans up
  await redis.lpush(config.queueName, JSON.stringify({ application_id: "app-1", retry_count: 0 }));
  const res1 = await processQueueMessageOnce(redis, config, mockFetch, console, { weightState });
  assert.equal(res1.status, "processed");
  assert.equal(calls[0].body.semantic_weight, 0.65);
  assert.equal(calls[0].body.keyword_weight, 0.35);
  assert.equal((redis._lists.get(config.processingQueueName) || []).length, 0);
  assert.equal(redis._published.length, 1);
  assert.equal(redis._published[0].channel, "APPLICATION_SCORED");

  // 2. Crash recovery: simulate task stuck in processing_queue past visibilityTimeoutMs
  const stuckPayload = JSON.stringify({ application_id: "app-crash", retry_count: 0 });
  await redis.lpush(config.processingQueueName, stuckPayload);
  await redis.hset(config.processingTimestampsKey, stuckPayload, String(Date.now() - 1000));

  const rec = await recoverStuckProcessingMessages(redis, config, Date.now(), console);
  assert.equal(rec.recovered, 1);
  assert.equal((redis._lists.get(config.processingQueueName) || []).length, 0);
  assert.equal((redis._lists.get(config.queueName) || []).length, 1);

  const resRecovered = await processQueueMessageOnce(redis, config, mockFetch, console, { weightState });
  assert.equal(resRecovered.status, "processed");

  // 3. Hot weight reload via CONFIG_UPDATED
  weightState.applyConfigUpdate({ scoringWeights: { semanticWeight: 0.75 } });
  await redis.lpush(config.queueName, JSON.stringify({ application_id: "app-weights", retry_count: 0 }));
  await processQueueMessageOnce(redis, config, mockFetch, console, { weightState });
  assert.equal(calls[2].body.semantic_weight, 0.75);
  assert.equal(calls[2].body.keyword_weight, 0.25);

  // 4. Exhausted retries (3) -> DLQ + /mark-failed callback
  failMode = true;
  await redis.lpush(config.queueName, JSON.stringify({ application_id: "app-fail", retry_count: 3 }));
  const dlqRes = await processQueueMessageOnce(redis, config, mockFetch, console, { weightState });
  assert.equal(dlqRes.status, "dead-letter");
  assert.equal((redis._lists.get(config.deadLetterQueueName) || []).length, 1);
  assert.ok(calls.some((c) => c.url.endsWith("/applications/app-fail/mark-failed")));
});
