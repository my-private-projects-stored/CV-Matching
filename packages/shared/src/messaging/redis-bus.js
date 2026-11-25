export const PUBSUB_CHANNELS = Object.freeze({
  JOB_STATUS_CHANGED: "JOB_STATUS_CHANGED",
  APPLICATION_SCORED: "APPLICATION_SCORED",
  APPLICATION_STATUS_CHANGED: "APPLICATION_STATUS_CHANGED",
  CONFIG_UPDATED: "CONFIG_UPDATED",
});

export const REDIS_KEYS = Object.freeze({
  tokenBlacklist: (jti) => `token:blacklist:${String(jti || "").trim()}`,
  userBlacklist: (userId) => `token:blacklist:user:${String(userId || "").trim()}`,
  failedLogin: (email) => `failed_login:${String(email || "").trim().toLowerCase()}`,
  jobsCache: (hash) => `jobs:cache:${String(hash || "").trim()}`,
  cvOptimizeCache: (resumeId, jobId) =>
    `cv_opt:${String(resumeId || "").trim()}:${String(jobId || "").trim()}`,
});

/**
 * Create Redis messaging, token blacklist, login lock, and cache-aside helpers.
 */
export function createRedisBus(redisClient, { publisherClient = null } = {}) {
  const pubClient = publisherClient || redisClient;

  async function publishEvent(channel, payload = {}) {
    const message = JSON.stringify({
      ...payload,
      published_at: new Date().toISOString(),
    });
    return pubClient.publish(channel, message);
  }

  async function blacklistToken(jti, ttlSeconds = 900) {
    const key = REDIS_KEYS.tokenBlacklist(jti);
    const ttl = Math.max(1, Number.parseInt(String(ttlSeconds), 10) || 900);
    await redisClient.set(key, "1", "EX", ttl);
  }

  async function blacklistUser(userId, ttlSeconds = 7 * 86400) {
    const key = REDIS_KEYS.userBlacklist(userId);
    const ttl = Math.max(1, Number.parseInt(String(ttlSeconds), 10) || 7 * 86400);
    await redisClient.set(key, "1", "EX", ttl);
  }

  async function isBlacklisted({ jti = null, userId = null } = {}) {
    const checks = [];
    if (jti) checks.push(redisClient.get(REDIS_KEYS.tokenBlacklist(jti)));
    if (userId) checks.push(redisClient.get(REDIS_KEYS.userBlacklist(userId)));
    if (checks.length === 0) return false;
    const results = await Promise.all(checks);
    return results.some((val) => val !== null && val !== undefined);
  }

  async function recordFailedLogin(email, { maxAttempts = 5, lockSeconds = 900 } = {}) {
    const key = REDIS_KEYS.failedLogin(email);
    const attempts = await redisClient.incr(key);
    await redisClient.expire(key, lockSeconds);
    return {
      attempts: Number(attempts),
      locked: Number(attempts) >= maxAttempts,
      lockSeconds,
    };
  }

  async function isLoginLocked(email, maxAttempts = 5) {
    const val = await redisClient.get(REDIS_KEYS.failedLogin(email));
    return Number(val || 0) >= maxAttempts;
  }

  async function clearFailedLogin(email) {
    await redisClient.del(REDIS_KEYS.failedLogin(email));
  }

  async function cacheGetJson(key) {
    const raw = await redisClient.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function cacheSetJson(key, value, ttlSeconds = 300) {
    const ttl = Math.max(1, Number.parseInt(String(ttlSeconds), 10) || 300);
    await redisClient.set(key, JSON.stringify(value), "EX", ttl);
  }

  async function cacheInvalidateByPrefix(prefix) {
    let cursor = "0";
    let deleted = 0;
    const pattern = `${prefix}*`;

    do {
      const [nextCursor, keys] = await redisClient.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = String(nextCursor);
      if (Array.isArray(keys) && keys.length > 0) {
        deleted += Number(await redisClient.del(...keys));
      }
    } while (cursor !== "0");

    return deleted;
  }

  return {
    publishEvent,
    blacklistToken,
    blacklistUser,
    isBlacklisted,
    recordFailedLogin,
    isLoginLocked,
    clearFailedLogin,
    cacheGetJson,
    cacheSetJson,
    cacheInvalidateByPrefix,
  };
}
