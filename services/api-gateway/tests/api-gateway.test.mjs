import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import { PUBSUB_CHANNELS, createRedisBus } from "@cvm/shared";
import { createApp } from "../src/app.js";

function createFakeRedis() {
  const store = new Map();
  const listeners = new Map();

  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async set(key, value) {
      store.set(key, String(value));
      return "OK";
    },
    async del(...keys) {
      let count = 0;
      for (const k of keys) {
        if (store.delete(k)) count += 1;
      }
      return count;
    },
    async incr(key) {
      const next = (Number.parseInt(store.get(key) || "0", 10) || 0) + 1;
      store.set(key, String(next));
      return next;
    },
    async expire() {
      return 1;
    },
    async ttl() {
      return 60;
    },
    async subscribe(channel) {
      if (!listeners.has(channel)) listeners.set(channel, []);
      return 1;
    },
    on(event, cb) {
      if (event === "message") {
        const list = listeners.get("__message__") || [];
        list.push(cb);
        listeners.set("__message__", list);
      }
    },
    emitMessage(channel, payload) {
      const list = listeners.get("__message__") || [];
      const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
      for (const cb of list) cb(channel, raw);
    },
  };
}

function startMockUpstream(serviceName) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const bodyBuffer = Buffer.concat(chunks);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            upstream: serviceName,
            method: req.method,
            url: req.url,
            headers: {
              "x-user-id": req.headers["x-user-id"] || null,
              "x-user-role": req.headers["x-user-role"] || null,
              "x-user-email": req.headers["x-user-email"] || null,
              "x-token-jti": req.headers["x-token-jti"] || null,
              "x-gateway-secret": req.headers["x-gateway-secret"] || null,
              "x-request-id": req.headers["x-request-id"] || null,
            },
            bodyLength: bodyBuffer.length,
            bodyText: bodyBuffer.toString("utf8"),
          })
        );
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${addr.port}`,
      });
    });
  });
}

function listenApp(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${addr.port}`,
      });
    });
  });
}

test("API Gateway Strangler Fig routing, auth/blacklist, rate limit, maintenance, and streaming", async (t) => {
  const jwtSecret = "test-gateway-jwt-secret";
  const gatewaySecret = "test-gateway-internal-secret";
  const fakeRedis = createFakeRedis();
  const redisBus = createRedisBus(fakeRedis);

  const [
    authUpstream,
    resumeUpstream,
    jobUpstream,
    applicationUpstream,
    recommendationUpstream,
    enrichmentUpstream,
    notificationUpstream,
    configAnalyticsUpstream,
  ] = await Promise.all([
    startMockUpstream("auth-service"),
    startMockUpstream("resume-service"),
    startMockUpstream("job-service"),
    startMockUpstream("application-service"),
    startMockUpstream("recommendation-service"),
    startMockUpstream("ai-enrichment-service"),
    startMockUpstream("notification-service"),
    startMockUpstream("config-analytics-service"),
  ]);

  const app = createApp({
    targets: {
      authService: authUpstream.url,
      resumeService: resumeUpstream.url,
      jobService: jobUpstream.url,
      applicationService: applicationUpstream.url,
      recommendationService: recommendationUpstream.url,
      aiEnrichmentService: enrichmentUpstream.url,
      notificationService: notificationUpstream.url,
      configAnalyticsService: configAnalyticsUpstream.url,
    },
    jwtSecret,
    gatewaySecret,
    redisClient: fakeRedis,
    subscriberClient: fakeRedis,
    redisBus,
    rateLimitConfig: { authLimit: 5, generalLimit: 120, windowSeconds: 60 },
  });

  const gw = await listenApp(app);

  t.after(() => {
    gw.server.close();
    authUpstream.server.close();
    resumeUpstream.server.close();
    jobUpstream.server.close();
    applicationUpstream.server.close();
    recommendationUpstream.server.close();
    enrichmentUpstream.server.close();
    notificationUpstream.server.close();
    configAnalyticsUpstream.server.close();
  });

  const candidateToken = jwt.sign(
    { id: "cand-1", role: "candidate", email: "c@example.com", jti: "jti-cand-1" },
    jwtSecret,
    { expiresIn: "15m" }
  );
  const legacyAdminToken = jwt.sign(
    { id: "staff-1", role: "admin", email: "staff@example.com", jti: "jti-staff-1" },
    jwtSecret,
    { expiresIn: "15m" }
  );

  // 1. Strangler Fig routing verification
  const rAuth = await fetch(`${gw.baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "a@b.com", password: "123" }),
  });
  assert.equal(rAuth.status, 200);
  const dAuth = await rAuth.json();
  assert.equal(dAuth.upstream, "auth-service");
  assert.equal(dAuth.url, "/api/auth/login");

  const rResume = await fetch(`${gw.baseUrl}/api/resumes?mine=1`, {
    headers: { Authorization: `Bearer ${candidateToken}` },
  });
  assert.equal(rResume.status, 200);
  const dResume = await rResume.json();
  assert.equal(dResume.upstream, "resume-service");
  assert.equal(dResume.url, "/api/resumes?mine=1");

  const rLegacyEnrich = await fetch(`${gw.baseUrl}/api/resumes/res-1/generate-cover-letter`, {
    method: "POST",
    headers: { Authorization: `Bearer ${candidateToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ jobId: "job-1" }),
  });
  assert.equal(rLegacyEnrich.status, 200);
  const dLegacyEnrich = await rLegacyEnrich.json();
  assert.equal(dLegacyEnrich.upstream, "ai-enrichment-service");

  const rJob = await fetch(`${gw.baseUrl}/api/jobs?q=node`);
  assert.equal(rJob.status, 200);
  const dJob = await rJob.json();
  assert.equal(dJob.upstream, "job-service");
  assert.equal(dJob.url, "/api/jobs?q=node");

  const rApps = await fetch(`${gw.baseUrl}/api/applications`, {
    headers: { Authorization: `Bearer ${candidateToken}` },
  });
  assert.equal(rApps.status, 200);
  assert.equal((await rApps.json()).upstream, "application-service");

  const rRecs = await fetch(`${gw.baseUrl}/api/recommendations`, {
    headers: { Authorization: `Bearer ${candidateToken}` },
  });
  assert.equal(rRecs.status, 200);
  assert.equal((await rRecs.json()).upstream, "recommendation-service");

  const rInterviews = await fetch(`${gw.baseUrl}/api/interviews/questions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${candidateToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(rInterviews.status, 200);
  assert.equal((await rInterviews.json()).upstream, "ai-enrichment-service");

  const rNotifs = await fetch(`${gw.baseUrl}/api/notifications`, {
    headers: { Authorization: `Bearer ${candidateToken}` },
  });
  assert.equal(rNotifs.status, 200);
  assert.equal((await rNotifs.json()).upstream, "notification-service");

  const rConfig = await fetch(`${gw.baseUrl}/api/config/scoring-weights`, {
    headers: { Authorization: `Bearer ${candidateToken}` },
  });
  assert.equal(rConfig.status, 200);
  assert.equal((await rConfig.json()).upstream, "config-analytics-service");

  // 2. Anti-spoofing: untrusted incoming x-user-* headers stripped on public route
  const rSpoof = await fetch(`${gw.baseUrl}/api/jobs`, {
    headers: {
      "x-user-id": "attacker",
      "x-user-role": "tech_staff",
      "x-gateway-secret": "wrong-secret",
    },
  });
  const dSpoof = await rSpoof.json();
  assert.equal(dSpoof.headers["x-user-id"], null);
  assert.equal(dSpoof.headers["x-user-role"], null);
  assert.equal(dSpoof.headers["x-gateway-secret"], null);

  // 3. Trusted header injection + admin -> tech_staff canonicalization
  const rStaff = await fetch(`${gw.baseUrl}/api/users`, {
    headers: { Authorization: `Bearer ${legacyAdminToken}` },
  });
  const dStaff = await rStaff.json();
  assert.equal(dStaff.upstream, "auth-service");
  assert.equal(dStaff.headers["x-user-id"], "staff-1");
  assert.equal(dStaff.headers["x-user-role"], "tech_staff");
  assert.equal(dStaff.headers["x-gateway-secret"], gatewaySecret);

  // 4. Redis Token Blacklist blocks immediately (< 200ms)
  await redisBus.blacklistToken("jti-cand-1", 300);
  const t0 = Date.now();
  const rRevoked = await fetch(`${gw.baseUrl}/api/resumes`, {
    headers: { Authorization: `Bearer ${candidateToken}` },
  });
  const elapsed = Date.now() - t0;
  assert.equal(rRevoked.status, 401);
  assert.equal((await rRevoked.json()).error_code, "token_revoked");
  assert.ok(elapsed < 200, `Expected blacklist check < 200ms, got ${elapsed}ms`);

  // 5. Rate limiter: 5 allowed on POST /api/auth/login, 6th returns 429
  for (let i = 0; i < 4; i += 1) {
    const ok = await fetch(`${gw.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.99" },
      body: JSON.stringify({ email: "x@y.com", password: "123" }),
    });
    assert.equal(ok.status, 200);
  }
  const ok5 = await fetch(`${gw.baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.99" },
    body: JSON.stringify({ email: "x@y.com", password: "123" }),
  });
  assert.equal(ok5.status, 200);
  const blocked6 = await fetch(`${gw.baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.99" },
    body: JSON.stringify({ email: "x@y.com", password: "123" }),
  });
  assert.equal(blocked6.status, 429);
  assert.equal((await blocked6.json()).error_code, "rate_limit_exceeded");

  // 6. Live Maintenance Mode via CONFIG_UPDATED blocks candidate (503) but allows tech_staff (200)
  const freshCandToken = jwt.sign(
    { id: "cand-2", role: "candidate", email: "c2@example.com", jti: "jti-cand-2" },
    jwtSecret,
    { expiresIn: "15m" }
  );
  fakeRedis.emitMessage(PUBSUB_CHANNELS.CONFIG_UPDATED, {
    maintenanceMode: { resumes: true },
  });
  const rMaintBlocked = await fetch(`${gw.baseUrl}/api/resumes`, {
    headers: { Authorization: `Bearer ${freshCandToken}` },
  });
  assert.equal(rMaintBlocked.status, 503);
  assert.equal((await rMaintBlocked.json()).error_code, "service_in_maintenance");

  const rMaintBypass = await fetch(`${gw.baseUrl}/api/resumes`, {
    headers: { Authorization: `Bearer ${legacyAdminToken}` },
  });
  assert.equal(rMaintBypass.status, 200);

  // Turn off maintenance and verify binary/multipart streaming passes untouched
  fakeRedis.emitMessage(PUBSUB_CHANNELS.CONFIG_UPDATED, {
    maintenanceMode: { resumes: false },
  });
  const form = new FormData();
  form.append("file", new Blob([Buffer.from("%PDF-1.4 sample binary")], { type: "application/pdf" }), "cv.pdf");
  const rUpload = await fetch(`${gw.baseUrl}/api/resumes/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${freshCandToken}` },
    body: form,
  });
  assert.equal(rUpload.status, 200);
  const dUpload = await rUpload.json();
  assert.equal(dUpload.upstream, "resume-service");
  assert.ok(dUpload.bodyText.includes("%PDF-1.4 sample binary"));
});
