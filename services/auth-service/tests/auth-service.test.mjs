import test from "node:test";
import assert from "node:assert/strict";
import { createRedisBus, isEncryptedPII } from "@cvm/shared";
import { createApp } from "../src/app.js";

function createFakeRedis() {
  const store = new Map();
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
  };
}

function createInMemoryUserStore() {
  const docs = new Map();
  let seq = 1;

  function wrap(raw) {
    if (!raw) return null;
    return {
      ...raw,
      async save() {
        raw.updatedAt = new Date();
        Object.assign(raw, this);
        docs.set(String(raw._id), raw);
        return this;
      },
      toSafeObject() {
        return {
          id: String(raw._id),
          name: raw.name,
          email: raw.email,
          role: raw.role === "admin" ? "tech_staff" : raw.role,
          rawRole: raw.role,
          disabled: Boolean(raw.disabled),
          disabledReason: raw.disabledReason || "",
        };
      },
    };
  }

  return {
    _docs: docs,
    async findOne(filter) {
      for (const raw of docs.values()) {
        if (filter.email && raw.email === filter.email) return wrap(raw);
        if (filter.resetPasswordTokenHash && raw.resetPasswordTokenHash === filter.resetPasswordTokenHash) {
          return wrap(raw);
        }
      }
      return null;
    },
    async findById(id) {
      return wrap(docs.get(String(id)) || null);
    },
    async create(payload) {
      const id = `user-${seq++}`;
      const raw = {
        _id: id,
        disabled: false,
        disabledReason: "",
        refreshTokenJti: null,
        candidateProfile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        ...payload,
      };
      docs.set(id, raw);
      return wrap(raw);
    },
    async find(filter = {}) {
      const list = [];
      for (const raw of docs.values()) {
        if (filter.disabled !== undefined && Boolean(raw.disabled) !== Boolean(filter.disabled)) continue;
        list.push(wrap(raw));
      }
      return list;
    },
    async countDocuments(filter = {}) {
      return (await this.find(filter)).length;
    },
  };
}

function createInMemoryAuditStore() {
  const logs = [];
  return {
    _logs: logs,
    async create(doc) {
      const created = { _id: `audit-${logs.length + 1}`, createdAt: new Date(), ...doc };
      logs.push(created);
      return created;
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

test("Auth service covers 4-role RBAC, refresh rotation, lockout 429, blacklist, audit logs, and AES-256-GCM PII", async (t) => {
  const fakeRedis = createFakeRedis();
  const redisBus = createRedisBus(fakeRedis);
  const UserModel = createInMemoryUserStore();
  const AuditLogModel = createInMemoryAuditStore();

  const app = createApp({
    UserModel,
    AuditLogModel,
    redisClient: fakeRedis,
    redisBus,
    jwtSecret: "auth-test-secret",
    jwtRefreshSecret: "auth-test-refresh-secret",
    gatewaySecret: "gw-secret",
    piiEncryptionKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  });

  const { server, baseUrl } = await listenApp(app);
  t.after(() => server.close());

  // 1. Self-signup rejects tech_staff (403) and accepts candidate via /register & sets HttpOnly cookie
  const badSignup = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Admin Wannabe",
      email: "bad@example.com",
      password: "password123",
      role: "tech_staff",
    }),
  });
  assert.equal(badSignup.status, 403);

  const candSignup = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Candidate One",
      email: "cand1@example.com",
      password: "password123",
      role: "candidate",
    }),
  });
  assert.equal(candSignup.status, 201);
  const setCookie = candSignup.headers.get("set-cookie") || "";
  assert.ok(setCookie.includes("cvm_refresh_token="));
  assert.ok(setCookie.toLowerCase().includes("httponly"));
  assert.ok(setCookie.toLowerCase().includes("samesite=strict"));
  const signupData = await candSignup.json();
  assert.ok(signupData.token);
  assert.ok(signupData.refresh_token);
  assert.equal(signupData.user.role, "candidate");

  // 2. Refresh token rotation & reuse detection
  const refreshResp = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: signupData.refresh_token }),
  });
  assert.equal(refreshResp.status, 200);
  const rotatedData = await refreshResp.json();
  assert.notEqual(rotatedData.refresh_token, signupData.refresh_token);

  const reuseResp = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: signupData.refresh_token }),
  });
  assert.equal(reuseResp.status, 401);

  // 3. PII AES-256-GCM encryption at rest in candidateProfile
  const freshLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "cand1@example.com", password: "password123" }),
  });
  assert.equal(freshLogin.status, 200);
  const loginData = await freshLogin.json();

  const putProfile = await fetch(`${baseUrl}/api/candidate-profile/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginData.token}`,
    },
    body: JSON.stringify({
      phone: "+84901234567",
      location: "Thu Dau Mot, Binh Duong",
      skills: ["Node.js", "MongoDB"],
    }),
  });
  assert.equal(putProfile.status, 200);
  const profileResp = await putProfile.json();
  assert.equal(profileResp.profile.phone, "+84901234567");
  assert.equal(profileResp.profile.location, "Thu Dau Mot, Binh Duong");

  const storedDoc = UserModel._docs.get(signupData.user.id);
  assert.ok(isEncryptedPII(storedDoc.candidateProfile.phone));
  assert.ok(isEncryptedPII(storedDoc.candidateProfile.location));
  assert.notEqual(storedDoc.candidateProfile.phone, "+84901234567");

  // 4. Logout blacklists access token jti immediately
  const logoutResp = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${loginData.token}` },
  });
  assert.equal(logoutResp.status, 200);
  const meAfterLogout = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${loginData.token}` },
  });
  assert.equal(meAfterLogout.status, 401);

  // 5. 5 failed login attempts lock account with HTTP 429
  for (let i = 1; i <= 4; i += 1) {
    const fail = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "cand1@example.com", password: "wrong" }),
    });
    assert.equal(fail.status, 401);
  }
  const fail5 = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "cand1@example.com", password: "wrong" }),
  });
  assert.equal(fail5.status, 429);
  assert.equal((await fail5.json()).error_code, "account_locked_temporarily");

  // Even valid password is blocked while locked
  const lockedLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "cand1@example.com", password: "password123" }),
  });
  assert.equal(lockedLogin.status, 429);

  // 6. Legacy admin alias acts as tech_staff: suspend requires reason, creates AuditLog & blacklists user
  const suspendNoReason = await fetch(`${baseUrl}/api/users/${signupData.user.id}/suspend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-gateway-secret": "gw-secret",
      "x-user-id": "staff-admin",
      "x-user-role": "admin",
    },
    body: JSON.stringify({}),
  });
  assert.equal(suspendNoReason.status, 400);

  const suspendOk = await fetch(`${baseUrl}/api/users/${signupData.user.id}/suspend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-gateway-secret": "gw-secret",
      "x-user-id": "staff-admin",
      "x-user-role": "admin",
    },
    body: JSON.stringify({ reason: "Policy violation" }),
  });
  assert.equal(suspendOk.status, 200);
  assert.equal(await redisBus.isBlacklisted({ userId: signupData.user.id }), true);
  assert.equal(AuditLogModel._logs.length, 1);
  assert.equal(AuditLogModel._logs[0].action, "SUSPEND_USER");
  assert.equal(AuditLogModel._logs[0].actorRole, "tech_staff");

  // 7. Update role -> platform_owner writes AuditLog
  const rolePatch = await fetch(`${baseUrl}/api/users/${signupData.user.id}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-gateway-secret": "gw-secret",
      "x-user-id": "staff-admin",
      "x-user-role": "tech_staff",
    },
    body: JSON.stringify({ role: "platform_owner", reason: "Promote owner" }),
  });
  assert.equal(rolePatch.status, 200);
  assert.equal((await rolePatch.json()).user.role, "platform_owner");
  assert.equal(AuditLogModel._logs.length, 2);
  assert.equal(AuditLogModel._logs[1].action, "UPDATE_ROLE");
});
