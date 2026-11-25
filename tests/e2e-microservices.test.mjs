import test from "node:test";
import assert from "node:assert/strict";
import { PUBSUB_CHANNELS, createRedisBus } from "../packages/shared/src/index.js";
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
} from "../workers/scoring/worker-core.js";

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
        for (const sub of subscribers) {
          sub._deliver(channel, message);
        }
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
    async insertMany(arr = []) {
      const out = [];
      for (const p of arr) out.push(await this.create(p));
      return out;
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
          } else if (v && typeof v === "object" && v.$gt) {
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
      const existing = filter._id ? docs.get(String(filter._id)) : await this.findOne(filter);
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
    async bulkWrite(ops = []) {
      let modifiedCount = 0;
      for (const op of ops) {
        if (op.updateOne) {
          const r = await this.findOneAndUpdate(op.updateOne.filter, op.updateOne.update);
          if (r) modifiedCount += 1;
        }
      }
      return { modifiedCount };
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

test("Full E2E Microservices Cluster via API Gateway (Zero Legacy Monolith)", async (t) => {
  const jwtSecret = "e2e-jwt-secret";
  const jwtRefreshSecret = "e2e-refresh-secret";
  const gatewaySecret = "e2e-gateway-secret";
  const internalToken = "e2e-worker-token";
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

  const minioStorage = {
    async uploadObject({ bucket, objectKey, buffer }) {
      return { bucket, objectKey, size: buffer.length };
    },
    async getPresignedDownloadUrl(bucket, objectKey) {
      return `http://minio.local/${bucket}/${objectKey}`;
    },
  };

  const qdrantVectors = new Map();
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
      parsingClient: { extractRawTextFromFile: async () => "Node.js MongoDB Redis Backend Engineer" },
      embeddingClient: { embedText: async () => new Array(384).fill(0.1) },
      vectorStore: {
        upsertResumeVector: async ({ resumeId }) => qdrantVectors.set(resumeId, new Array(384).fill(0.1)),
      },
      redisClient: redisHub.createClient(),
      jwtSecret,
      gatewaySecret,
      internalToken,
    })
  );
  const jobSrv = await listenApp(
    createJobApp({
      CompanyModel,
      JobModel,
      minioStorage,
      embeddingClient: { embedText: async () => new Array(384).fill(0.1) },
      vectorStore: { upsertJobVector: async ({ jobId }) => qdrantVectors.set(jobId, new Array(384).fill(0.1)) },
      redisBus: createRedisBus(redisHub.createClient()),
      jwtSecret,
      gatewaySecret,
      internalToken,
    })
  );
  const appExpress = createApplicationApp({
    ApplicationModel,
    OutboxEventModel,
    JobStatusMirrorModel,
    redisClient: appRedisClient,
    subscriberClient: appSubClient,
    redisBus: createRedisBus(appRedisClient),
    runInTransaction: async (fn) => fn(null),
    scoringStep: async () => ({
      semanticScore: 0.9,
      keywordScore: 0.7,
      matchedKeywords: ["node", "redis"],
      missingKeywords: [],
    }),
    jwtSecret,
    gatewaySecret,
    internalToken,
  });
  const appSrv = await listenApp(appExpress);

  const recSrv = await listenApp(
    createRecommendationApp({
      qdrantClient: null,
      redisBus: createRedisBus(redisHub.createClient()),
      jobCatalogClient: {
        listActiveJobs: async () => ({ jobs: Array.from(JobModel._docs.values()), pagination: { page: 1, limit: 20, total: 1 } }),
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
  const enrichSrv = await listenApp(
    createEnrichmentApp({
      AiGenerationEventModel: AiEventModel,
      InterviewQuestionModel,
      redisClient: enrichmentClient,
      subscriberClient: enrichmentSub,
      redisBus: createRedisBus(enrichmentClient),
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
    })
  );

  t.after(() => {
    notifExpress.locals.sseHub.closeAll();
    [gatewaySrv, authSrv, resumeSrv, jobSrv, appSrv, recSrv, enrichSrv, notifSrv, cfgSrv].forEach((s) =>
      s.server.close()
    );
  });

  // 1. Candidate & Recruiter signup through API Gateway
  const candAuth = await (
    await fetch(`${gatewaySrv.url}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice", email: "alice@e2e.com", password: "password123", role: "candidate" }),
    })
  ).json();
  const recAuth = await (
    await fetch(`${gatewaySrv.url}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bob HR", email: "bob@e2e.com", password: "password123", role: "recruiter" }),
    })
  ).json();

  // Create tech_staff & platform_owner directly in UserModel and login
  await fetch(`${gatewaySrv.url}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Ops", email: "ops@e2e.com", password: "password123", role: "candidate" }),
  });
  const opsDoc = await UserModel.findOne({ email: "ops@e2e.com" });
  opsDoc.role = "tech_staff";
  await opsDoc.save();
  const staffAuth = await (
    await fetch(`${gatewaySrv.url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ops@e2e.com", password: "password123" }),
    })
  ).json();

  await fetch(`${gatewaySrv.url}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Owner", email: "owner@e2e.com", password: "password123", role: "candidate" }),
  });
  const ownerDoc = await UserModel.findOne({ email: "owner@e2e.com" });
  ownerDoc.role = "platform_owner";
  await ownerDoc.save();
  const ownerAuth = await (
    await fetch(`${gatewaySrv.url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@e2e.com", password: "password123" }),
    })
  ).json();

  // 2. Recruiter publishes active Job via Gateway
  const jobRes = await fetch(`${gatewaySrv.url}/api/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${recAuth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Backend Engineer",
      description: "Node.js MongoDB Redis",
      category: "backend",
      skills: ["Node.js", "MongoDB", "Redis"],
      status: "active",
    }),
  });
  assert.equal(jobRes.status, 201);
  const jobId = String((await jobRes.json()).job._id);

  // 3. Candidate uploads PDF CV via Gateway
  const cvForm = new FormData();
  cvForm.append("file", new Blob([Buffer.from("%PDF-1.4\nAlice CV")], { type: "application/pdf" }), "cv.pdf");
  const cvRes = await fetch(`${gatewaySrv.url}/api/resumes/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${candAuth.token}` },
    body: cvForm,
  });
  assert.equal(cvRes.status, 201);
  const resumeId = String((await cvRes.json()).resume._id);

  // 4. Candidate connects SSE stream & submits Application -> Outbox -> worker-scoring -> SSE toast!
  const sseAc = new AbortController();
  const sseResp = await fetch(`${gatewaySrv.url}/api/notifications/stream?token=${encodeURIComponent(candAuth.token)}`, {
    signal: sseAc.signal,
  });
  assert.equal(sseResp.status, 200);
  const sseReader = sseResp.body.getReader();
  const decoder = new TextDecoder();
  await sseReader.read(); // ": connected"

  const subRes = await fetch(`${gatewaySrv.url}/api/applications`, {
    method: "POST",
    headers: { Authorization: `Bearer ${candAuth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId, resume_id: resumeId }),
  });
  assert.equal(subRes.status, 201);
  const appId = (await subRes.json()).application_id;

  await appExpress.locals.outboxPublisher.publishPendingOnce();

  const workerRedis = redisHub.createClient();
  const workerConfig = buildWorkerConfig({
    BACKEND_INTERNAL_BASE_URL: `${appSrv.url}/api/internal`,
    WORKER_INTERNAL_TOKEN: internalToken,
  });
  const weightState = createWeightState(workerConfig.semanticWeight);
  const workerSubscriber = redisHub.createClient();
  workerSubscriber.on("message", (ch, raw) => {
    if (ch === PUBSUB_CHANNELS.CONFIG_UPDATED) weightState.applyConfigUpdate(JSON.parse(raw));
  });

  const scoredOutcome = await processQueueMessageOnce(workerRedis, workerConfig, fetch, console, { weightState });
  assert.equal(scoredOutcome.status, "processed");

  const sseChunk1 = decoder.decode((await sseReader.read()).value);
  assert.ok(sseChunk1.includes("ai_scoring_completed"));

  // 5. TECH_STAFF hot-updates scoringWeights -> worker receives CONFIG_UPDATED without restart
  const wtRes = await fetch(`${gatewaySrv.url}/api/config/scoring-weights`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${staffAuth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ semanticWeight: 0.7, keywordWeight: 0.3 }),
  });
  assert.equal(wtRes.status, 200);
  assert.deepEqual(weightState.getWeights(), { semanticWeight: 0.7, keywordWeight: 0.3 });

  // 6. Recruiter moves application new -> screening -> interview -> auto-generates recruiter questions + SSE toast
  await fetch(`${gatewaySrv.url}/api/applications/${appId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${recAuth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "screening", __v: 0 }),
  });
  await fetch(`${gatewaySrv.url}/api/applications/${appId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${recAuth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "interview", __v: 1 }),
  });
  await appExpress.locals.outboxPublisher.publishPendingOnce();
  await new Promise((r) => setTimeout(r, 40));

  const iqResp = await fetch(`${gatewaySrv.url}/api/interviews/questions/${appId}?audience=recruiter`, {
    headers: { Authorization: `Bearer ${recAuth.token}` },
  });
  assert.equal(iqResp.status, 200);
  assert.equal((await iqResp.json()).questionSets.length, 1);

  sseAc.abort();
  await sseReader.cancel().catch(() => {});

  // 7. PLATFORM_OWNER reads BI Overview & Funnel
  const biOverview = await (
    await fetch(`${gatewaySrv.url}/api/config-analytics/analytics/overview?range=30d`, {
      headers: { Authorization: `Bearer ${ownerAuth.token}` },
    })
  ).json();
  assert.equal(biOverview.kpis.totalApplications, 1);
  assert.equal(biOverview.kpis.activeJobs, 1);
});
