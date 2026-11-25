import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createRedisBus } from "../packages/shared/src/index.js";
import { createApp as createGatewayApp } from "../services/api-gateway/src/app.js";
import { createApp as createAuthApp } from "../services/auth-service/src/app.js";
import { createApp as createResumeApp } from "../services/resume-service/src/app.js";
import { createApp as createJobApp } from "../services/job-service/src/app.js";
import { createApp as createApplicationApp } from "../services/application-service/src/app.js";
import { createApp as createRecommendationApp } from "../services/recommendation-service/src/app.js";
import { createApp as createEnrichmentApp } from "../services/ai-enrichment-service/src/app.js";
import { createApp as createNotificationApp } from "../services/notification-service/src/app.js";
import { createApp as createConfigAnalyticsApp } from "../services/config-analytics-service/src/app.js";
import {
  buildWorkerConfig,
  createWeightState,
  processQueueMessageOnce,
  recoverStuckProcessingMessages,
} from "../workers/scoring/worker-core.js";
import {
  buildNotificationWorkerConfig,
  processNotificationQueueOnce,
} from "../workers/notification/worker-core.js";

function createSharedRedisHub() {
  const kv = new Map();
  const lists = new Map();
  const hashes = new Map();
  const subscribers = new Set();

  function getList(key) {
    if (!lists.has(key)) lists.set(key, []);
    return lists.get(key);
  }
  function getHash(key) {
    if (!hashes.has(key)) hashes.set(key, new Map());
    return hashes.get(key);
  }

  function createClient() {
    const messageHandlers = [];
    const client = {
      async ping() {
        return "PONG";
      },
      async get(key) {
        return kv.has(key) ? kv.get(key) : null;
      },
      async set(key, value) {
        kv.set(key, String(value));
        return "OK";
      },
      async del(...keys) {
        let count = 0;
        for (const k of keys) {
          if (kv.delete(k)) count += 1;
        }
        return count;
      },
      async incr(key) {
        const next = (Number.parseInt(kv.get(key) || "0", 10) || 0) + 1;
        kv.set(key, String(next));
        return next;
      },
      async expire() {
        return 1;
      },
      async ttl() {
        return 60;
      },
      async scan(_cursor, _match, pattern) {
        const prefix = pattern.replace(/\*$/, "");
        return ["0", Array.from(kv.keys()).filter((k) => k.startsWith(prefix))];
      },
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
      async rpop(key) {
        const list = getList(key);
        return list.length > 0 ? list.pop() : null;
      },
      async llen(key) {
        return getList(key).length;
      },
      async lrange(key, start, stop) {
        const list = getList(key);
        const end = stop < 0 ? list.length + 1 + stop : stop + 1;
        return list.slice(start, end);
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
      async subscribe() {
        return 1;
      },
      on(event, cb) {
        if (event === "message") messageHandlers.push(cb);
      },
      async publish(channel, message) {
        for (const sub of subscribers) sub._deliver(channel, message);
        return 1;
      },
      _deliver(channel, message) {
        for (const cb of messageHandlers) cb(channel, message);
      },
    };
    subscribers.add(client);
    return client;
  }

  return { createClient, kv, lists };
}

function createMemoryModel(prefix) {
  const docs = new Map();
  let seq = 1;

  function wrap(raw) {
    if (!raw) return null;
    return {
      ...raw,
      async save() {
        const { save: _ignore, toSafeObject: _tso, ...plain } = this;
        plain.updatedAt = new Date();
        Object.assign(raw, plain);
        docs.set(String(raw._id), raw);
        return this;
      },
      toSafeObject() {
        return {
          id: String(raw._id),
          name: raw.name,
          email: raw.email,
          role: raw.role === "admin" ? "tech_staff" : raw.role,
          disabled: Boolean(raw.disabled),
        };
      },
    };
  }

  return {
    _docs: docs,
    async create(payload) {
      const id = String(payload._id || `${prefix}-${seq++}`);
      const raw = {
        __v: 0,
        createdAt: new Date(Date.now() + seq),
        updatedAt: new Date(),
        ...payload,
        _id: id,
      };
      docs.set(id, raw);
      return wrap(raw);
    },
    async findById(id) {
      return wrap(docs.get(String(id)) || null);
    },
    async findOne(filter = {}) {
      for (const raw of docs.values()) {
        let match = true;
        for (const [k, v] of Object.entries(filter)) {
          if (v && typeof v === "object" && v.$ne !== undefined) {
            if (raw[k] === v.$ne) match = false;
          } else if (String(raw[k]) !== String(v)) {
            match = false;
          }
        }
        if (match) return wrap(raw);
      }
      return null;
    },
    async find(filter = {}) {
      const list = [];
      for (const raw of docs.values()) {
        let match = true;
        for (const [k, v] of Object.entries(filter)) {
          if (v && typeof v === "object" && v.$in) {
            if (!v.$in.includes(raw[k])) match = false;
          } else if (v && typeof v === "object" && v.$gt !== undefined) {
            if (!(raw[k] > v.$gt)) match = false;
          } else if (v && typeof v === "object" && v.$ne !== undefined) {
            if (raw[k] === v.$ne) match = false;
          } else if (String(raw[k]) !== String(v)) {
            match = false;
          }
        }
        if (match) list.push(wrap(raw));
      }
      return list;
    },
    async countDocuments(filter = {}) {
      return (await this.find(filter)).length;
    },
    async findOneAndUpdate(filter, update, opts = {}) {
      let existing = filter._id ? docs.get(String(filter._id)) : null;
      if (!existing && !filter._id) {
        for (const raw of docs.values()) {
          let match = true;
          for (const [k, v] of Object.entries(filter)) {
            if (v && typeof v === "object" && v.$ne !== undefined) {
              if (raw[k] === v.$ne) match = false;
            } else if (String(raw[k]) !== String(v)) {
              match = false;
            }
          }
          if (match) {
            existing = raw;
            break;
          }
        }
      }
      if (!existing) {
        if (!opts.upsert) return null;
        return this.create({ ...filter, ...(update.$set || {}) });
      }
      if (filter.__v !== undefined && Number(existing.__v) !== Number(filter.__v)) return null;
      if (update.$set) Object.assign(existing, update.$set);
      if (update.$inc?.__v) existing.__v += Number(update.$inc.__v);
      if (update.$push?.statusHistory) {
        existing.statusHistory = [...(existing.statusHistory || []), update.$push.statusHistory];
      }
      existing.updatedAt = new Date();
      return wrap(existing);
    },
  };
}

function listenApp(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

test("Security & Chaos Fault-Injection Verification Suite", async (t) => {
  const jwtSecret = "sec-jwt-secret";
  const jwtRefreshSecret = "sec-refresh-secret";
  const gatewaySecret = "sec-gateway-secret";
  const internalToken = "sec-worker-token";
  const redisHub = createSharedRedisHub();

  const UserModel = createMemoryModel("user");
  const AuthAuditModel = createMemoryModel("auth-audit");
  const ResumeModel = createMemoryModel("res");
  const CompanyModel = createMemoryModel("comp");
  const JobModel = createMemoryModel("job");
  const ApplicationModel = createMemoryModel("app");
  const OutboxEventModel = createMemoryModel("outbox");
  const JobStatusMirrorModel = createMemoryModel("mirror");
  const AiEventModel = createMemoryModel("ai-evt");
  const InterviewQuestionModel = createMemoryModel("iq");
  const NotificationModel = createMemoryModel("notif");
  const SystemConfigModel = createMemoryModel("cfg");
  const OpsAuditModel = createMemoryModel("ops-audit");

  const minioUploads = [];
  const minioStorage = {
    async uploadObject({ bucket, objectKey, buffer }) {
      minioUploads.push({ bucket, objectKey, size: buffer.length });
      return { bucket, objectKey, size: buffer.length };
    },
    async getPresignedDownloadUrl(bucket, objectKey) {
      return `http://minio.local/${bucket}/${objectKey}`;
    },
  };

  const authClient = redisHub.createClient();
  const appRedisClient = redisHub.createClient();
  const appSubClient = redisHub.createClient();
  const enrichmentClient = redisHub.createClient();
  const enrichmentSub = redisHub.createClient();
  const notifClient = redisHub.createClient();
  const notifSub = redisHub.createClient();
  const cfgClient = redisHub.createClient();
  const gwClient = redisHub.createClient();
  const gwSub = redisHub.createClient();

  const appExpress = createApplicationApp({
    ApplicationModel,
    OutboxEventModel,
    JobStatusMirrorModel,
    redisClient: appRedisClient,
    subscriberClient: appSubClient,
    redisBus: createRedisBus(appRedisClient),
    runInTransaction: async (fn) => fn(null),
    scoringStep: async () => ({
      semanticScore: 0.85,
      keywordScore: 0.75,
      matchedKeywords: ["node.js", "redis"],
      missingKeywords: ["k8s"],
    }),
    jwtSecret,
    gatewaySecret,
    internalToken,
  });
  const appSrv = await listenApp(appExpress);

  const authSrv = await listenApp(
    createAuthApp({
      UserModel,
      AuditLogModel: AuthAuditModel,
      redisClient: authClient,
      redisBus: createRedisBus(authClient),
      jwtSecret,
      jwtRefreshSecret,
      gatewaySecret,
      internalToken,
    })
  );

  const resumeSrv = await listenApp(
    createResumeApp({
      ResumeModel,
      minioStorage,
      parsingClient: { extractRawTextFromFile: async () => "Node.js MongoDB Redis Engineer" },
      embeddingClient: { embedText: async () => new Array(384).fill(0.1) },
      vectorStore: { upsertResumeVector: async () => {} },
      redisClient: redisHub.createClient(),
      jwtSecret,
      gatewaySecret,
      internalToken,
      canRecruiterAccessResume: async (recruiterId, resumeId, candidateId) => {
        const resp = await fetch(
          `${appSrv.url}/internal/access-check?recruiterId=${encodeURIComponent(recruiterId)}&resumeId=${encodeURIComponent(resumeId)}&candidateId=${encodeURIComponent(candidateId)}`,
          { headers: { "x-internal-token": internalToken } }
        );
        if (!resp.ok) return false;
        const body = await resp.json();
        return Boolean(body?.allowed);
      },
    })
  );

  let jobSrvClosed = false;
  const jobSrv = await listenApp(
    createJobApp({
      CompanyModel,
      JobModel,
      minioStorage,
      embeddingClient: { embedText: async () => new Array(384).fill(0.1) },
      vectorStore: { upsertJobVector: async () => {}, deleteJobVector: async () => {} },
      redisBus: createRedisBus(redisHub.createClient()),
      jwtSecret,
      gatewaySecret,
      internalToken,
    })
  );

  // Qdrant client intentionally times out to test Chaos Qdrant outage -> keyword fallback
  const hangingQdrantClient = {
    async retrieve() {
      return new Promise(() => {}); // hangs past qdrantTimeoutMs
    },
    async search() {
      return new Promise(() => {});
    },
  };

  const recSrv = await listenApp(
    createRecommendationApp({
      qdrantClient: hangingQdrantClient,
      qdrantTimeoutMs: 120,
      redisBus: createRedisBus(redisHub.createClient()),
      jobCatalogClient: {
        listActiveJobs: async () => ({
          jobs: Array.from(JobModel._docs.values()).filter((j) => j.status === "active"),
          pagination: { page: 1, limit: 20, total: JobModel._docs.size },
        }),
        getJobById: async (id) => JobModel.findById(id),
      },
      resumeCatalogClient: {
        getResumeById: async (id) => ResumeModel.findById(id),
        listCandidateResumes: async () => Array.from(ResumeModel._docs.values()),
      },
      jwtSecret,
      gatewaySecret,
    })
  );

  // Failing LLM provider to test Chaos Gemini outage -> template_fallback
  const failingLlmProvider = {
    providerName: "gemini",
    modelName: "gemini-2.0-flash",
    async optimizeCv() {
      throw new Error("Gemini 503 Service Unavailable");
    },
    async generateCoverLetter() {
      throw new Error("Gemini 503 Service Unavailable");
    },
    async generateOutreach() {
      throw new Error("Gemini 503 Service Unavailable");
    },
    async generateInterviewQuestions() {
      throw new Error("Gemini 503 Service Unavailable");
    },
  };

  const enrichSrv = await listenApp(
    createEnrichmentApp({
      AiGenerationEventModel: AiEventModel,
      InterviewQuestionModel,
      redisClient: enrichmentClient,
      subscriberClient: enrichmentSub,
      redisBus: createRedisBus(enrichmentClient),
      llmProvider: failingLlmProvider,
      jwtSecret,
      gatewaySecret,
    })
  );

  const notifExpress = createNotificationApp({
    NotificationModel,
    redisClient: notifClient,
    subscriberClient: notifSub,
    redisBus: createRedisBus(notifClient),
    jwtSecret,
    gatewaySecret,
    internalToken,
  });
  const notifSrv = await listenApp(notifExpress);

  const cfgSrv = await listenApp(
    createConfigAnalyticsApp({
      SystemConfigModel,
      AuditLogModel: OpsAuditModel,
      redisClient: cfgClient,
      redisBus: createRedisBus(cfgClient),
      analyticsProvider: {
        loadSnapshot: async () => ({
          users: Array.from(UserModel._docs.values()),
          resumes: Array.from(ResumeModel._docs.values()),
          jobs: Array.from(JobModel._docs.values()),
          applications: Array.from(ApplicationModel._docs.values()),
        }),
      },
      jwtSecret,
      gatewaySecret,
    })
  );

  const gatewaySrv = await listenApp(
    createGatewayApp({
      targets: {
        authService: authSrv.url,
        resumeService: resumeSrv.url,
        jobService: jobSrv.url,
        applicationService: appSrv.url,
        recommendationService: recSrv.url,
        aiEnrichmentService: enrichSrv.url,
        notificationService: notifSrv.url,
        configAnalyticsService: cfgSrv.url,
      },
      jwtSecret,
      gatewaySecret,
      redisClient: gwClient,
      subscriberClient: gwSub,
      redisBus: createRedisBus(gwClient),
      rateLimitConfig: { authLimit: 1000, generalLimit: 10000, windowSeconds: 60 },
    })
  );

  t.after(async () => {
    notifExpress.locals.sseHub.closeAll();
    appExpress.locals.outboxPublisher.stop();
    const servers = [gatewaySrv, authSrv, resumeSrv, appSrv, recSrv, enrichSrv, notifSrv, cfgSrv];
    if (!jobSrvClosed) servers.push(jobSrv);
    await Promise.all(servers.map((s) => new Promise((r) => s.server.close(r))));
  });

  // Seed 4-role actors
  const candAuth = await (
    await fetch(`${gatewaySrv.url}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice", email: "alice@sec.local", password: "Password123!", role: "candidate" }),
    })
  ).json();

  const recAAuth = await (
    await fetch(`${gatewaySrv.url}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Recruiter A", email: "rec-a@sec.local", password: "Password123!", role: "recruiter" }),
    })
  ).json();

  const recBAuth = await (
    await fetch(`${gatewaySrv.url}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Recruiter B", email: "rec-b@sec.local", password: "Password123!", role: "recruiter" }),
    })
  ).json();

  await fetch(`${gatewaySrv.url}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Owner", email: "owner@sec.local", password: "Password123!", role: "candidate" }),
  });
  const ownerDoc = await UserModel.findOne({ email: "owner@sec.local" });
  ownerDoc.role = "platform_owner";
  await ownerDoc.save();
  const ownerAuth = await (
    await fetch(`${gatewaySrv.url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@sec.local", password: "Password123!" }),
    })
  ).json();

  // Setup job + CV + application for IDOR and Chaos tests
  const jobAResp = await fetch(`${gatewaySrv.url}/api/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${recAAuth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Backend Node.js Engineer",
      description: "Node.js MongoDB Redis",
      category: "backend",
      skills: ["Node.js", "MongoDB", "Redis"],
      status: "draft",
    }),
  });
  assert.equal(jobAResp.status, 201);
  const jobAId = String((await jobAResp.json()).job._id);
  const jobAPublishResp = await fetch(`${gatewaySrv.url}/api/jobs/${jobAId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${recAAuth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "active" }),
  });
  if (jobAPublishResp.status !== 200) {
    throw new Error(`jobAPublishResp ${jobAPublishResp.status}: ${await jobAPublishResp.text()}`);
  }
  assert.equal(jobAPublishResp.status, 200);

  const jobClosedResp = await fetch(`${gatewaySrv.url}/api/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${recAAuth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Closed Legacy Role",
      description: "Archived",
      category: "backend",
      skills: ["Node.js"],
      status: "active",
    }),
  });
  assert.equal(jobClosedResp.status, 201);
  const jobClosedId = String((await jobClosedResp.json()).job._id);
  const jobCloseActionResp = await fetch(`${gatewaySrv.url}/api/jobs/${jobClosedId}/close`, {
    method: "POST",
    headers: { Authorization: `Bearer ${recAAuth.token}` },
  });
  assert.equal(jobCloseActionResp.status, 200);
  await new Promise((r) => setTimeout(r, 20));

  const validForm = new FormData();
  validForm.append("file", new Blob([Buffer.from("%PDF-1.4\nAlice Resume")], { type: "application/pdf" }), "alice.pdf");
  const cvUploadResp = await fetch(`${gatewaySrv.url}/api/resumes/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${candAuth.token}` },
    body: validForm,
  });
  assert.equal(cvUploadResp.status, 201);
  const resumeId = String((await cvUploadResp.json()).resume._id);

  const applyResp = await fetch(`${gatewaySrv.url}/api/applications`, {
    method: "POST",
    headers: { Authorization: `Bearer ${candAuth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobAId, resume_id: resumeId }),
  });
  assert.equal(applyResp.status, 201);
  const appId = (await applyResp.json()).application_id;
  await appExpress.locals.outboxPublisher.publishPendingOnce();

  await t.test("Security 1: Cross-Company HR IDOR on CV download returns 403", async () => {
    const recADownload = await fetch(`${gatewaySrv.url}/api/resumes/${resumeId}/download`, {
      headers: { Authorization: `Bearer ${recAAuth.token}` },
    });
    assert.equal(recADownload.status, 200);

    const recBDownload = await fetch(`${gatewaySrv.url}/api/resumes/${resumeId}/download`, {
      headers: { Authorization: `Bearer ${recBAuth.token}` },
    });
    assert.equal(recBDownload.status, 403);
  });

  await t.test("Security 2: Candidate blocked (403) from recruiter interview questions", async () => {
    await fetch(`${gatewaySrv.url}/api/applications/${appId}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${recAAuth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "screening", __v: 0 }),
    });
    await fetch(`${gatewaySrv.url}/api/applications/${appId}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${recAAuth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "interview", __v: 1 }),
    });
    await appExpress.locals.outboxPublisher.publishPendingOnce();
    await new Promise((r) => setTimeout(r, 40));

    const recResp = await fetch(`${gatewaySrv.url}/api/interviews/questions/${appId}?audience=recruiter`, {
      headers: { Authorization: `Bearer ${recAAuth.token}` },
    });
    assert.equal(recResp.status, 200);

    const candResp = await fetch(`${gatewaySrv.url}/api/interviews/questions/${appId}?audience=recruiter`, {
      headers: { Authorization: `Bearer ${candAuth.token}` },
    });
    assert.equal(candResp.status, 403);
  });

  await t.test("Security 3: 4-Role RBAC privilege escalation blocked (403)", async () => {
    for (const forbiddenRole of ["tech_staff", "platform_owner"]) {
      const signupRes = await fetch(`${gatewaySrv.url}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Attacker",
          email: `atk-${forbiddenRole}@sec.local`,
          password: "Password123!",
          role: forbiddenRole,
        }),
      });
      assert.equal(signupRes.status, 403);
    }

    const qRes = await fetch(`${gatewaySrv.url}/api/config-analytics/queues`, {
      headers: { Authorization: `Bearer ${candAuth.token}` },
    });
    assert.equal(qRes.status, 403);

    const biForbidden = await fetch(`${gatewaySrv.url}/api/config-analytics/analytics/overview`, {
      headers: { Authorization: `Bearer ${recAAuth.token}` },
    });
    assert.equal(biForbidden.status, 403);

    const biAllowed = await fetch(`${gatewaySrv.url}/api/config-analytics/analytics/overview`, {
      headers: { Authorization: `Bearer ${ownerAuth.token}` },
    });
    assert.equal(biAllowed.status, 200);
  });

  await t.test("Security 4: Magic Bytes rejects spoofed .exe disguised as .pdf (400)", async () => {
    const uploadsBefore = minioUploads.length;
    const peHeader = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ executable
    const badForm = new FormData();
    badForm.append("file", new Blob([peHeader], { type: "application/pdf" }), "malicious.pdf");

    const resp = await fetch(`${gatewaySrv.url}/api/resumes/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${candAuth.token}` },
      body: badForm,
    });
    assert.equal(resp.status, 400);
    assert.equal(minioUploads.length, uploadsBefore);
  });

  await t.test("Security 5: Brute-force 5 wrong login attempts trigger 429 lockout", async () => {
    await fetch(`${gatewaySrv.url}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Victim", email: "victim@sec.local", password: "Password123!", role: "candidate" }),
    });

    for (let i = 0; i < 4; i++) {
      const bad = await fetch(`${gatewaySrv.url}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "victim@sec.local", password: "WrongPassword!" }),
      });
      assert.equal(bad.status, 401);
    }

    const fifthBad = await fetch(`${gatewaySrv.url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "victim@sec.local", password: "WrongPassword!" }),
    });
    assert.equal(fifthBad.status, 429);

    const locked = await fetch(`${gatewaySrv.url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "victim@sec.local", password: "Password123!" }),
    });
    assert.equal(locked.status, 429);
  });

  await t.test("Security 6: HttpOnly + SameSite=Strict cookie & Refresh Token Reuse revocation", async () => {
    await fetch(`${gatewaySrv.url}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "RotUser", email: "rot@sec.local", password: "Password123!", role: "candidate" }),
    });

    const loginResp = await fetch(`${gatewaySrv.url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "rot@sec.local", password: "Password123!" }),
    });
    assert.equal(loginResp.status, 200);
    const setCookie = loginResp.headers.get("set-cookie") || "";
    assert.match(setCookie, /cvm_refresh_token=/i);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Strict/i);

    const loginJson = await loginResp.json();
    const rt1 = loginJson.refresh_token;

    const r1 = await fetch(`${gatewaySrv.url}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt1 }),
    });
    assert.equal(r1.status, 200);
    const rt2 = (await r1.json()).refresh_token;

    // Replay rt1 -> reuse detected -> 401 and family revoked
    const replay1 = await fetch(`${gatewaySrv.url}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt1 }),
    });
    assert.equal(replay1.status, 401);

    const replay2 = await fetch(`${gatewaySrv.url}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt2 }),
    });
    assert.equal(replay2.status, 401);
  });

  await t.test("Security 7: Redis Access Token Blacklist revokes session in < 200ms", async () => {
    const tempSignup = await (
      await fetch(`${gatewaySrv.url}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "LogoutUser", email: "logout@sec.local", password: "Password123!", role: "candidate" }),
      })
    ).json();

    const outResp = await fetch(`${gatewaySrv.url}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tempSignup.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: tempSignup.refresh_token }),
    });
    assert.equal(outResp.status, 200);

    const t0 = performance.now();
    const meResp = await fetch(`${gatewaySrv.url}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tempSignup.token}` },
    });
    const elapsed = performance.now() - t0;
    assert.equal(meResp.status, 401);
    assert.ok(elapsed < 200, `Expected < 200ms revocation check, got ${elapsed}ms`);
  });

  await t.test("Security 8: AES-256-GCM PII ciphertext at rest (zero plaintext in DB)", async () => {
    const putResp = await fetch(`${gatewaySrv.url}/api/candidate-profile/me`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${candAuth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+84901234567",
        location: "Thu Dau Mot, Binh Duong",
        headline: "Backend Engineer",
      }),
    });
    assert.equal(putResp.status, 200);

    const rawUser = UserModel._docs.get(candAuth.user.id);
    assert.ok(rawUser.candidateProfile.phone.startsWith("enc:v1:"));
    assert.ok(!rawUser.candidateProfile.phone.includes("901234567"));
    assert.ok(rawUser.candidateProfile.location.startsWith("enc:v1:"));
    assert.ok(!rawUser.candidateProfile.location.includes("Binh Duong"));

    const getResp = await fetch(`${gatewaySrv.url}/api/candidate-profile/me`, {
      headers: { Authorization: `Bearer ${candAuth.token}` },
    });
    assert.equal(getResp.status, 200);
    const getBody = await getResp.json();
    assert.equal(getBody.profile.phone, "+84901234567");
    assert.equal(getBody.profile.location, "Thu Dau Mot, Binh Duong");
  });

  await t.test("Chaos 1: Qdrant timeout/outage degrades to keyword fallback (200)", async () => {
    const resp = await fetch(`${gatewaySrv.url}/api/recommendations/jobs?resume_id=${encodeURIComponent(resumeId)}`, {
      headers: { Authorization: `Bearer ${candAuth.token}` },
    });
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.fallback_mode, "keyword");
    assert.equal(body.source, "keyword_fallback");
    assert.ok(Array.isArray(body.recommendations) && body.recommendations.length >= 1);
  });

  await t.test("Chaos 2: Gemini LLM outage degrades to deterministic template_fallback (200)", async () => {
    const resp = await fetch(`${gatewaySrv.url}/api/enrichment/optimize-cv`, {
      method: "POST",
      headers: { Authorization: `Bearer ${candAuth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeId,
        jobId: jobAId,
        resumeText: "Node.js developer",
        jobDescription: "Node.js MongoDB Redis Docker",
        missingKeywords: ["Docker"],
      }),
    });
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.generation_mode, "template_fallback");
    const logged = await AiEventModel.find({ generation_mode: "template_fallback" });
    assert.ok(logged.length >= 1);
  });

  await t.test("Chaos 3: SMTP outage triggers 3 retries + DLQ without crashing API", async () => {
    const nRedis = redisHub.createClient();
    const nCfg = buildNotificationWorkerConfig({ NOTIFICATION_MAX_RETRIES: "3" });
    while ((await nRedis.rpop(nCfg.queueName)) !== null) {}
    await nRedis.lpush(
      nCfg.queueName,
      JSON.stringify({
        type: "application_status_changed",
        recipient_email: "alice@sec.local",
        recipient_name: "Alice",
        job_title: "Backend Node.js Engineer",
        to_status: "interview",
        application_id: appId,
      })
    );

    const failingSmtp = async () => ({ delivered: false, error: "ECONNREFUSED smtp:587" });
    for (let i = 0; i < 3; i++) {
      const r = await processNotificationQueueOnce(nRedis, nCfg, { sendEmailImpl: failingSmtp });
      assert.equal(r.status, "retry");
    }
    const finalRes = await processNotificationQueueOnce(nRedis, nCfg, { sendEmailImpl: failingSmtp });
    assert.equal(finalRes.status, "dead-letter");

    assert.equal(await nRedis.llen(nCfg.deadLetterQueueName), 1);
    assert.equal(await nRedis.llen(nCfg.processingQueueName), 0);

    const apiStillUp = await fetch(`${gatewaySrv.url}/api/notifications`, {
      headers: { Authorization: `Bearer ${candAuth.token}` },
    });
    assert.equal(apiStillUp.status, 200);
  });

  await t.test("Chaos 4: job-service shutdown leaves application-service operational via JobStatusMirror", async () => {
    await new Promise((resolve) => jobSrv.server.close(resolve));
    jobSrvClosed = true;

    // New CV so unique constraint allows applying to jobAId again
    const form2 = new FormData();
    form2.append("file", new Blob([Buffer.from("%PDF-1.4\nAlice CV 2")], { type: "application/pdf" }), "alice2.pdf");
    const cv2 = await (
      await fetch(`${gatewaySrv.url}/api/resumes/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${candAuth.token}` },
        body: form2,
      })
    ).json();

    // Active job succeeds even with job-service down
    const okApply = await fetch(`${gatewaySrv.url}/api/applications`, {
      method: "POST",
      headers: { Authorization: `Bearer ${candAuth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobAId, resume_id: String(cv2.resume._id) }),
    });
    assert.equal(okApply.status, 201);

    // Closed job blocked even with job-service down
    const closedApply = await fetch(`${gatewaySrv.url}/api/applications`, {
      method: "POST",
      headers: { Authorization: `Bearer ${candAuth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobClosedId, resume_id: String(cv2.resume._id) }),
    });
    assert.ok(closedApply.status === 400 || closedApply.status === 409);
  });

  await t.test("Chaos 5: worker-scoring mid-processing crash recovers stuck task (0 lost)", async () => {
    const wRedis = redisHub.createClient();
    const wCfg = buildWorkerConfig({
      BACKEND_INTERNAL_BASE_URL: `${appSrv.url}/api/internal`,
      WORKER_INTERNAL_TOKEN: internalToken,
      SCORING_VISIBILITY_TIMEOUT_MS: "60000",
    });

    // Clear any leftover queue items and drain outbox first
    while ((await appExpress.locals.outboxPublisher.publishPendingOnce()).published > 0) {}
    while ((await wRedis.rpop(wCfg.queueName)) !== null) {}

    const stuckPayload = JSON.stringify({ application_id: appId, job_id: jobAId, resume_id: resumeId });
    await wRedis.lpush(wCfg.queueName, stuckPayload);
    // Simulate worker moving to processing_queue then crashing 120s ago
    await wRedis.blmove(wCfg.queueName, wCfg.processingQueueName, "RIGHT", "LEFT", 1);
    await wRedis.hset(wCfg.processingTimestampsKey, stuckPayload, String(Date.now() - 120_000));

    const rec = await recoverStuckProcessingMessages(wRedis, wCfg, Date.now());
    assert.equal(rec.recovered, 1);
    assert.equal(await wRedis.llen(wCfg.processingQueueName), 0);
    assert.equal(await wRedis.llen(wCfg.queueName), 1);

    const outcome = await processQueueMessageOnce(wRedis, wCfg, fetch, console, {
      weightState: createWeightState(0.65),
    });
    assert.equal(outcome.status, "processed");
  });
});
