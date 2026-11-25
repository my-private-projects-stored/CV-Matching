import test from "node:test";
import assert from "node:assert/strict";

import { PUBSUB_CHANNELS, REDIS_KEYS, createRedisBus } from "../src/messaging/redis-bus.js";

function createFakeRedis() {
  const store = new Map();
  const published = [];
  return {
    published,
    async set(key, val) {
      store.set(key, String(val));
      return "OK";
    },
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async del(...keys) {
      let count = 0;
      for (const k of keys) {
        if (store.delete(k)) count += 1;
      }
      return count;
    },
    async incr(key) {
      const next = Number(store.get(key) || 0) + 1;
      store.set(key, String(next));
      return next;
    },
    async expire() {
      return 1;
    },
    async scan(cursor, _m, pattern) {
      const prefix = pattern.replace(/\*$/, "");
      const matched = [...store.keys()].filter((k) => k.startsWith(prefix));
      return ["0", matched];
    },
    async publish(channel, msg) {
      published.push({ channel, msg: JSON.parse(msg) });
      return 1;
    },
  };
}

test("createRedisBus handles token/user blacklisting and failed login locking", async () => {
  const fake = createFakeRedis();
  const bus = createRedisBus(fake);

  await bus.blacklistToken("jti-123", 600);
  assert.equal(await bus.isBlacklisted({ jti: "jti-123" }), true);
  assert.equal(await bus.isBlacklisted({ jti: "jti-other" }), false);

  await bus.blacklistUser("user-99");
  assert.equal(await bus.isBlacklisted({ userId: "user-99" }), true);

  for (let i = 1; i <= 4; i += 1) {
    const r = await bus.recordFailedLogin("User@Test.com");
    assert.equal(r.locked, false);
  }
  const fifth = await bus.recordFailedLogin("user@test.com");
  assert.equal(fifth.attempts, 5);
  assert.equal(fifth.locked, true);
  assert.equal(await bus.isLoginLocked("user@test.com"), true);

  await bus.clearFailedLogin("user@test.com");
  assert.equal(await bus.isLoginLocked("user@test.com"), false);
});

test("createRedisBus manages cache-aside JSON, SCAN invalidation, and Pub/Sub events", async () => {
  const fake = createFakeRedis();
  const bus = createRedisBus(fake);

  await bus.cacheSetJson(REDIS_KEYS.jobsCache("it-hcm"), { total: 2 });
  assert.deepEqual(await bus.cacheGetJson(REDIS_KEYS.jobsCache("it-hcm")), { total: 2 });

  const deleted = await bus.cacheInvalidateByPrefix("jobs:cache:");
  assert.equal(deleted, 1);
  assert.equal(await bus.cacheGetJson(REDIS_KEYS.jobsCache("it-hcm")), null);

  await bus.publishEvent(PUBSUB_CHANNELS.JOB_STATUS_CHANGED, { jobId: "j1", status: "closed" });
  assert.equal(fake.published.length, 1);
  assert.equal(fake.published[0].channel, "JOB_STATUS_CHANGED");
  assert.equal(fake.published[0].msg.jobId, "j1");
});
