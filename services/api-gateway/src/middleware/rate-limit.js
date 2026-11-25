const AUTH_RATE_LIMIT_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/register",
]);

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function createInMemoryCounterStore() {
  const buckets = new Map();

  return {
    async incrAndExpire(key, windowSeconds) {
      const now = Date.now();
      const existing = buckets.get(key);
      if (!existing || existing.expiresAt <= now) {
        const entry = {
          count: 1,
          expiresAt: now + windowSeconds * 1000,
        };
        buckets.set(key, entry);
        return { count: 1, ttl: windowSeconds };
      }

      existing.count += 1;
      const ttl = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
      return { count: existing.count, ttl };
    },
  };
}

/**
 * Redis-backed (with optional in-memory test fallback) sliding-window rate limiter.
 * Auth endpoints allow 5 req/min/IP; general API endpoints allow 120 req/min/IP.
 */
export function createRateLimiter({
  redisClient = null,
  authLimit = 5,
  generalLimit = 120,
  windowSeconds = 60,
} = {}) {
  const memoryStore = createInMemoryCounterStore();

  async function incrementCounter(key) {
    if (redisClient && typeof redisClient.incr === "function") {
      const count = Number(await redisClient.incr(key));
      if (count === 1) {
        await redisClient.expire(key, windowSeconds);
      }
      let ttl = windowSeconds;
      if (typeof redisClient.ttl === "function") {
        const rawTtl = Number(await redisClient.ttl(key));
        if (rawTtl > 0) ttl = rawTtl;
      }
      return { count, ttl };
    }

    return memoryStore.incrAndExpire(key, windowSeconds);
  }

  return async function rateLimitMiddleware(req, res, next) {
    try {
      const path = (req.originalUrl || req.url || "").split("?")[0];
      if (path === "/api/health" || !path.startsWith("/api")) {
        return next();
      }

      const isAuthBucket = req.method === "POST" && AUTH_RATE_LIMIT_PATHS.has(path);
      const limit = isAuthBucket ? authLimit : generalLimit;
      const bucketName = isAuthBucket ? `auth:${path}` : "general";
      const ip = getClientIp(req);
      const key = `ratelimit:${bucketName}:${ip}`;

      const { count, ttl } = await incrementCounter(key);
      const remaining = Math.max(0, limit - count);

      res.setHeader("X-RateLimit-Limit", String(limit));
      res.setHeader("X-RateLimit-Remaining", String(remaining));

      if (count > limit) {
        res.setHeader("Retry-After", String(ttl));
        return res.status(429).json({
          message: isAuthBucket
            ? "Too many authentication attempts. Please try again later."
            : "Rate limit exceeded. Please slow down.",
          error_code: "rate_limit_exceeded",
          retry_after_seconds: ttl,
          ...(req.requestId ? { request_id: req.requestId } : {}),
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
