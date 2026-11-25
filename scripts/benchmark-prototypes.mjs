import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
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
} from "../workers/scoring/worker-core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

function parseArgs(argv = process.argv.slice(2)) {
  const opts = {
    mode: "embedded",
    gateway: "http://localhost:3001",
    internalAppUrl: "http://localhost:5004",
    internalToken: process.env.WORKER_INTERNAL_TOKEN || "dev-worker-token",
  };
  for (const arg of argv) {
    if (arg.startsWith("--mode=")) opts.mode = arg.split("=")[1];
    else if (arg.startsWith("--gateway=")) opts.gateway = arg.split("=")[1];
    else if (arg.startsWith("--internal-app=")) opts.internalAppUrl = arg.split("=")[1];
  }
  return opts;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Number(sorted[idx].toFixed(2));
}

function summarizeLatencies(samples, totalDurationMs) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avgMs = sorted.length ? Number((sum / sorted.length).toFixed(2)) : 0;
  const durationSec = Number((totalDurationMs / 1000).toFixed(3));
  return {
    count: sorted.length,
    minMs: sorted.length ? Number(sorted[0].toFixed(2)) : 0,
    avgMs,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    maxMs: sorted.length ? Number(sorted[sorted.length - 1].toFixed(2)) : 0,
    durationSec,
    throughputPerSec: durationSec > 0 ? Number((sorted.length / durationSec).toFixed(2)) : 0,
  };
}

async function runPool(total, concurrency, workerFn) {
  let cursor = 0;
  async function runner() {
    while (true) {
      const idx = cursor++;
      if (idx >= total) return;
      await workerFn(idx);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, total) }, () => runner());
  await Promise.all(workers);
}

function createSharedRedisHub() {
  const kv = new Map();
  const lists = new Map();
  const hashes = new Map();
  const subscribers = new Set();

  function getList(key) {
    let list = lists.get(key);
    if (!list) {
      list = [];
      lists.set(key, list);
    }
    return list;
  }

  function getHash(key) {
    let h = hashes.get(key);
    if (!h) {
      h = new Map();
      hashes.set(key, h);
    }
    return h;
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

function createFastMemoryModel(prefix, { indexFields = [] } = {}) {
  const docs = new Map();
  const indexes = new Map(); // field -> Map(val -> Set(id))
  for (const field of indexFields) {
    indexes.set(field, new Map());
  }
  let seq = 1;

  function indexDoc(id, raw) {
    for (const field of indexFields) {
      const val = raw[field] !== undefined ? String(raw[field]) : undefined;
      if (val === undefined) continue;
      const fieldMap = indexes.get(field);
      let bucket = fieldMap.get(val);
      if (!bucket) {
        bucket = new Set();
        fieldMap.set(val, bucket);
      }
      bucket.add(id);
    }
  }

  function matchesFilter(raw, filter) {
    for (const [k, v] of Object.entries(filter)) {
      if (v && typeof v === "object" && v.$in) {
        if (!v.$in.includes(raw[k])) return false;
      } else if (v && typeof v === "object" && v.$gt !== undefined) {
        if (!(raw[k] > v.$gt)) return false;
      } else if (v && typeof v === "object" && v.$ne !== undefined) {
        if (raw[k] === v.$ne) return false;
      } else if (String(raw[k]) !== String(v)) {
        return false;
      }
    }
    return true;
  }

  function candidateIdsForFilter(filter) {
    let bestSet = null;
    for (const field of indexFields) {
      const val = filter[field];
      if (val !== undefined && (typeof val === "string" || typeof val === "number")) {
        const set = indexes.get(field).get(String(val));
        if (!set || set.size === 0) return [];
        if (!bestSet || set.size < bestSet.size) bestSet = set;
      }
    }
    return bestSet ? Array.from(bestSet) : null;
  }

  function wrap(raw) {
    if (!raw) return null;
    return {
      ...raw,
      async save() {
        const { save: _ignore, toSafeObject: _tso, ...plain } = this;
        plain.updatedAt = new Date();
        Object.assign(raw, plain);
        docs.set(String(raw._id), raw);
        indexDoc(String(raw._id), raw);
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
      indexDoc(id, raw);
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
      const ids = candidateIdsForFilter(filter);
      if (ids !== null) {
        for (const id of ids) {
          const raw = docs.get(id);
          if (raw && matchesFilter(raw, filter)) return wrap(raw);
        }
        return null;
      }
      for (const raw of docs.values()) {
        if (matchesFilter(raw, filter)) return wrap(raw);
      }
      return null;
    },
    async find(filter = {}, opts = {}) {
      const ids = candidateIdsForFilter(filter);
      const list = [];
      const limit = opts?.limit ? Number(opts.limit) : Infinity;

      if (ids !== null) {
        for (const id of ids) {
          const raw = docs.get(id);
          if (raw && matchesFilter(raw, filter)) {
            list.push(wrap(raw));
            if (list.length >= limit && !opts?.sort) break;
          }
        }
      } else {
        for (const raw of docs.values()) {
          if (matchesFilter(raw, filter)) {
            list.push(wrap(raw));
            if (list.length >= limit && !opts?.sort) break;
          }
        }
      }
      if (opts?.limit && list.length > opts.limit) {
        return list.slice(0, opts.limit);
      }
      return list;
    },
    async countDocuments(filter = {}) {
      return (await this.find(filter)).length;
    },
    async findOneAndUpdate(filter, update, opts = {}) {
      let existing = filter._id ? docs.get(String(filter._id)) : null;
      if (!existing && !filter._id) {
        const ids = candidateIdsForFilter(filter);
        if (ids !== null) {
          for (const id of ids) {
            const raw = docs.get(id);
            if (raw && matchesFilter(raw, filter)) {
              existing = raw;
              break;
            }
          }
        } else {
          for (const raw of docs.values()) {
            if (matchesFilter(raw, filter)) {
              existing = raw;
              break;
            }
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
      indexDoc(String(existing._id), existing);
      return wrap(existing);
    },
    async bulkWrite(ops = []) {
      let modifiedCount = 0;
      for (const op of ops) {
        if (op.updateOne) {
          const f = op.updateOne.filter;
          const existing = f?._id ? docs.get(String(f._id)) : null;
          if (existing && matchesFilter(existing, f)) {
            const u = op.updateOne.update;
            if (u.$set) Object.assign(existing, u.$set);
            if (u.$inc?.__v) existing.__v += Number(u.$inc.__v);
            if (u.$push?.statusHistory) {
              existing.statusHistory = [...(existing.statusHistory || []), u.$push.statusHistory];
            }
            existing.updatedAt = new Date();
            modifiedCount += 1;
          }
        }
      }
      return { modifiedCount };
    },
  };
}

function toQdrantPointId(id) {
  const hex = crypto.createHash("sha256").update(String(id)).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function createInMemoryQdrant() {
  const collections = new Map();
  function getCol(name) {
    let col = collections.get(name);
    if (!col) {
      col = new Map();
      collections.set(name, col);
    }
    return col;
  }

  function cosine(a, b) {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  return {
    async upsert(collectionName, point) {
      getCol(collectionName).set(point.id, point);
    },
    async retrieve(collectionName, { ids = [] }) {
      const col = getCol(collectionName);
      return ids.map((id) => col.get(id)).filter(Boolean);
    },
    async search(collectionName, { vector, limit = 10, score_threshold = 0.6 }) {
      const col = getCol(collectionName);
      const hits = [];
      for (const pt of col.values()) {
        const score = cosine(vector, pt.vector);
        if (score >= score_threshold) {
          hits.push({ id: pt.id, score, payload: pt.payload });
        }
      }
      hits.sort((a, b) => b.score - a.score);
      return hits.slice(0, limit);
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

function makeSeededVector(seed, dim = 384) {
  const vec = new Array(dim);
  for (let i = 0; i < dim; i++) {
    vec[i] = Number((Math.sin(seed * 0.13 + i * 0.05) * 0.5 + 0.5).toFixed(4));
  }
  return vec;
}

async function setupEmbeddedCluster() {
  const jwtSecret = "bench-jwt-secret";
  const jwtRefreshSecret = "bench-refresh-secret";
  const gatewaySecret = "bench-gateway-secret";
  const internalToken = "bench-worker-token";
  const redisHub = createSharedRedisHub();
  const qdrant = createInMemoryQdrant();

  const UserModel = createFastMemoryModel("user", { indexFields: ["email"] });
  const AuthAuditModel = createFastMemoryModel("auth-audit");
  const ResumeModel = createFastMemoryModel("res", { indexFields: ["candidateId"] });
  const CompanyModel = createFastMemoryModel("comp");
  const JobModel = createFastMemoryModel("job", { indexFields: ["status", "category"] });
  const ApplicationModel = createFastMemoryModel("app", { indexFields: ["resumeId", "jobId", "status"] });
  const OutboxEventModel = createFastMemoryModel("outbox", { indexFields: ["status"] });
  const JobStatusMirrorModel = createFastMemoryModel("mirror", { indexFields: ["jobId"] });
  const AiEventModel = createFastMemoryModel("ai-evt");
  const InterviewQuestionModel = createFastMemoryModel("iq");
  const NotificationModel = createFastMemoryModel("notif", { indexFields: ["recipientId"] });
  const SystemConfigModel = createFastMemoryModel("cfg", { indexFields: ["key"] });
  const OpsAuditModel = createFastMemoryModel("ops-audit");

  const minioStorage = {
    async uploadObject({ bucket, objectKey, buffer }) {
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
  const recRedisClient = redisHub.createClient();

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
      parsingClient: {
        extractRawTextFromFile: async () => "Senior Backend Engineer Node.js MongoDB Redis Docker Kubernetes",
      },
      embeddingClient: {
        embedText: async () => makeSeededVector(1),
      },
      vectorStore: {
        upsertResumeVector: async ({ resumeId, vector }) =>
          qdrant.upsert("resumes_vectors", {
            id: toQdrantPointId(resumeId),
            vector,
            payload: { mongoId: String(resumeId) },
          }),
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
      embeddingClient: { embedText: async () => makeSeededVector(1) },
      vectorStore: {
        upsertJobVector: async ({ jobId, vector, status }) =>
          qdrant.upsert("jobs_vectors", {
            id: toQdrantPointId(jobId),
            vector,
            payload: { mongoId: String(jobId), status: status || "active" },
          }),
      },
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
      semanticScore: 0.88,
      keywordScore: 0.72,
      matchedKeywords: ["node.js", "mongodb", "redis"],
      missingKeywords: ["docker"],
    }),
    jwtSecret,
    gatewaySecret,
    internalToken,
  });
  const appSrv = await listenApp(appExpress);

  const recSrv = await listenApp(
    createRecommendationApp({
      qdrantClient: qdrant,
      redisBus: createRedisBus(recRedisClient),
      jobCatalogClient: {
        listActiveJobs: async ({ query = "", category = "", page = 1, limit = 20 }) => {
          const all = Array.from(JobModel._docs.values()).filter((j) => {
            if (j.status !== "active") return false;
            if (category && String(j.category).toLowerCase() !== category) return false;
            if (query && !String(j.title).toLowerCase().includes(query)) return false;
            return true;
          });
          const start = (page - 1) * limit;
          return {
            jobs: all.slice(start, start + limit),
            pagination: { page, limit, total: all.length },
          };
        },
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
      dailyCandidateQuota: 500,
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
      rateLimitConfig: { authLimit: 1000, generalLimit: 100000, windowSeconds: 60 },
    })
  );

  return {
    gatewayUrl: gatewaySrv.url,
    appInternalBaseUrl: `${appSrv.url}/api/internal`,
    internalToken,
    redisHub,
    appExpress,
    JobModel,
    qdrant,
    async close() {
      notifExpress.locals.sseHub.closeAll();
      appExpress.locals.outboxPublisher.stop();
      await Promise.all(
        [gatewaySrv, authSrv, resumeSrv, jobSrv, appSrv, recSrv, enrichSrv, notifSrv, cfgSrv].map(
          (s) => new Promise((r) => s.server.close(r))
        )
      );
    },
  };
}

async function runBenchmark() {
  const opts = parseArgs();
  if (opts.mode !== "embedded" && opts.mode !== "live") {
    throw new Error(`Unsupported --mode=${opts.mode}`);
  }

  let cluster = null;
  if (opts.mode === "embedded") {
    cluster = await setupEmbeddedCluster();
  }

  const gatewayUrl = opts.mode === "embedded" ? cluster.gatewayUrl : opts.gateway;
  const internalToken = opts.mode === "embedded" ? cluster.internalToken : opts.internalToken;
  const appInternalBaseUrl =
    opts.mode === "embedded" ? cluster.appInternalBaseUrl : `${opts.internalAppUrl}/api/internal`;

  try {
    // Sign up Candidate & Recruiter
    const candSignup = await fetch(`${gatewayUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Benchmark Candidate",
        email: `bench-cand-${Date.now()}@test.local`,
        password: "password123",
        role: "candidate",
      }),
    });
    const candAuth = await candSignup.json();

    const recSignup = await fetch(`${gatewayUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Benchmark Recruiter",
        email: `bench-rec-${Date.now()}@test.local`,
        password: "password123",
        role: "recruiter",
      }),
    });
    const recAuth = await recSignup.json();

    // =====================================================================
    // PROTOTYPE 1: 500 CV Uploads (Parse + Embed + Vectorize)
    // =====================================================================
    const p1MemStart = process.memoryUsage();
    const p1Latencies = [];
    const uploadedResumeIds = [];
    let p1Failed = 0;
    const pdfPayload = Buffer.from("%PDF-1.4\nBenchmark Candidate CV Node.js MongoDB Redis Docker");
    const p1Start = performance.now();

    await runPool(500, 10, async (idx) => {
      const form = new FormData();
      form.append("file", new Blob([pdfPayload], { type: "application/pdf" }), `cv-${idx}.pdf`);
      const t0 = performance.now();
      const resp = await fetch(`${gatewayUrl}/api/resumes/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${candAuth.token}` },
        body: form,
      });
      const elapsed = performance.now() - t0;
      p1Latencies.push(elapsed);
      if (resp.status === 201) {
        const body = await resp.json();
        uploadedResumeIds.push(String(body.resume._id));
      } else {
        p1Failed += 1;
      }
    });

    const p1DurationMs = performance.now() - p1Start;
    const p1MemEnd = process.memoryUsage();
    const p1Stats = summarizeLatencies(p1Latencies, p1DurationMs);

    // =====================================================================
    // PROTOTYPE 2: 5,000 Applications + Outbox + Reliable worker-scoring
    // =====================================================================
    const jobResp = await fetch(`${gatewayUrl}/api/jobs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${recAuth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Senior Backend Engineer",
        description: "Node.js MongoDB Redis Docker microservices",
        category: "backend",
        skills: ["Node.js", "MongoDB", "Redis", "Docker"],
        status: "active",
      }),
    });
    const jobId = String((await jobResp.json()).job._id);

    const p2SubmitLatencies = [];
    const submittedAppIds = [];
    let p2SubmitFailed = 0;
    const p2SubmitStart = performance.now();

    await runPool(5000, 8, async (idx) => {
      const uniqueResumeId = `bench-res-${idx}`;
      const t0 = performance.now();
      const resp = await fetch(`${gatewayUrl}/api/applications`, {
        method: "POST",
        headers: { Authorization: `Bearer ${candAuth.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, resume_id: uniqueResumeId }),
      });
      const elapsed = performance.now() - t0;
      p2SubmitLatencies.push(elapsed);
      if (resp.status === 201) {
        const body = await resp.json();
        submittedAppIds.push(String(body.application_id));
      } else {
        p2SubmitFailed += 1;
      }
    });

    const p2SubmitDurationMs = performance.now() - p2SubmitStart;
    const p2SubmitStats = summarizeLatencies(p2SubmitLatencies, p2SubmitDurationMs);

    // Drain Outbox into Redis queue
    let outboxDrained = 0;
    if (cluster) {
      while (true) {
        const res = await cluster.appExpress.locals.outboxPublisher.publishPendingOnce();
        outboxDrained += res.published;
        if (res.published === 0) break;
      }
    }

    // Drain 5,000 items via worker-scoring BLMOVE across 10 concurrent worker loops
    const workerConfig = buildWorkerConfig({
      BACKEND_INTERNAL_BASE_URL: appInternalBaseUrl,
      WORKER_INTERNAL_TOKEN: internalToken,
    });
    const weightState = createWeightState(0.65);
    let scoredCount = 0;
    let scoringErrors = 0;
    const p2ScoreStart = performance.now();

    if (cluster) {
      const workerLoops = Array.from({ length: 10 }, async () => {
        const workerRedis = cluster.redisHub.createClient();
        while (true) {
          const outcome = await processQueueMessageOnce(workerRedis, workerConfig, fetch, console, {
            weightState,
          });
          if (outcome.status === "empty") break;
          if (outcome.status === "processed") scoredCount += 1;
          else scoringErrors += 1;
        }
      });
      await Promise.all(workerLoops);
    }

    const p2ScoreDurationMs = performance.now() - p2ScoreStart;
    const p2ScoreDurationSec = Number((p2ScoreDurationMs / 1000).toFixed(3));
    const p2ScoringThroughput =
      p2ScoreDurationSec > 0 ? Number((scoredCount / p2ScoreDurationSec).toFixed(2)) : 0;

    const mainQueueRemaining = cluster
      ? await cluster.redisHub.createClient().llen(workerConfig.queueName)
      : 0;
    const processingQueueRemaining = cluster
      ? await cluster.redisHub.createClient().llen(workerConfig.processingQueueName)
      : 0;
    const dlqCount = cluster
      ? await cluster.redisHub.createClient().llen(workerConfig.deadLetterQueueName)
      : 0;

    // =====================================================================
    // PROTOTYPE 3: Search Cache-Aside, Qdrant HNSW, Direct Match, BulkWrite
    // =====================================================================
    if (cluster) {
      for (let i = 0; i < 200; i++) {
        const j = await cluster.JobModel.create({
          title: `Software Engineer #${i}`,
          description: "Node.js TypeScript MongoDB Redis Qdrant",
          category: i % 2 === 0 ? "backend" : "fullstack",
          skills: ["Node.js", "MongoDB", "Redis"],
          status: "active",
        });
        await cluster.qdrant.upsert("jobs_vectors", {
          id: toQdrantPointId(j._id),
          vector: makeSeededVector((i % 5) + 1),
          payload: { mongoId: String(j._id), status: "active" },
        });
      }
      // Top up 300 more vectors to reach 500 job vectors
      for (let i = 200; i < 500; i++) {
        await cluster.qdrant.upsert("jobs_vectors", {
          id: toQdrantPointId(`extra-job-${i}`),
          vector: makeSeededVector((i % 15) + 1),
          payload: { mongoId: jobId, status: "active" },
        });
      }
    }

    // 3A. Cache Miss (50 distinct queries) vs Cache Hit (200 repeated queries)
    const missLatencies = [];
    let missVerified = 0;
    const tMissStart = performance.now();
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      const resp = await fetch(`${gatewayUrl}/api/recommendations/search?q=engineer&page=${i + 1}&limit=10`);
      missLatencies.push(performance.now() - t0);
      const body = await resp.json();
      if (body.cache_hit === false) missVerified += 1;
    }
    const missStats = summarizeLatencies(missLatencies, performance.now() - tMissStart);

    const hitLatencies = [];
    let hitVerified = 0;
    const tHitStart = performance.now();
    for (let i = 0; i < 200; i++) {
      const page = (i % 50) + 1;
      const t0 = performance.now();
      const resp = await fetch(`${gatewayUrl}/api/recommendations/search?q=engineer&page=${page}&limit=10`);
      hitLatencies.push(performance.now() - t0);
      const body = await resp.json();
      if (body.cache_hit === true) hitVerified += 1;
    }
    const hitStats = summarizeLatencies(hitLatencies, performance.now() - tHitStart);

    // 3B. Qdrant HNSW Recommendations (100 requests)
    const targetResumeId = uploadedResumeIds[0];
    const hnswLatencies = [];
    let hnswSucceeded = 0;
    const tHnswStart = performance.now();
    for (let i = 0; i < 100; i++) {
      const t0 = performance.now();
      const resp = await fetch(
        `${gatewayUrl}/api/recommendations/jobs?resume_id=${encodeURIComponent(targetResumeId)}&limit=10`,
        { headers: { Authorization: `Bearer ${candAuth.token}` } }
      );
      hnswLatencies.push(performance.now() - t0);
      if (resp.status === 200) hnswSucceeded += 1;
    }
    const hnswStats = summarizeLatencies(hnswLatencies, performance.now() - tHnswStart);

    // 3C. Direct CV-JD Evaluation (20 requests)
    const directLatencies = [];
    let directSucceeded = 0;
    const tDirectStart = performance.now();
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      const resp = await fetch(`${gatewayUrl}/api/enrichment/optimize-cv`, {
        method: "POST",
        headers: { Authorization: `Bearer ${candAuth.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId: targetResumeId,
          jobId,
          resumeText: `Candidate CV iteration ${i} with Node.js and MongoDB`,
          jobDescription: "Looking for Senior Backend Engineer with Node.js, Redis, Docker",
          missingKeywords: ["Docker", "Kubernetes"],
        }),
      });
      directLatencies.push(performance.now() - t0);
      if (resp.status === 200) directSucceeded += 1;
    }
    const directStats = summarizeLatencies(directLatencies, performance.now() - tDirectStart);

    // 3D. BulkWrite 500 Applications
    const bulkIds = submittedAppIds.slice(0, 500);
    const tBulkStart = performance.now();
    const bulkResp = await fetch(`${gatewayUrl}/api/applications/bulk-status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${recAuth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ application_ids: bulkIds, status: "screening" }),
    });
    const bulkDurationMs = Number((performance.now() - tBulkStart).toFixed(2));
    const bulkBody = await bulkResp.json();
    const bulkUpdatedCount = Number(
      bulkBody?.updatedCount ?? bulkBody?.updated_count ?? bulkBody?.modifiedCount ?? 0
    );

    const results = {
      generatedAt: new Date().toISOString(),
      environment: {
        mode: opts.mode,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      prototype1: {
        description: "500 CV uploads (Magic Bytes + MinIO + Parse + 384-dim Embed + Qdrant)",
        total: 500,
        succeeded: uploadedResumeIds.length,
        failed: p1Failed,
        ...p1Stats,
        memory: {
          rssStartMB: Number((p1MemStart.rss / 1048576).toFixed(2)),
          rssEndMB: Number((p1MemEnd.rss / 1048576).toFixed(2)),
          heapUsedStartMB: Number((p1MemStart.heapUsed / 1048576).toFixed(2)),
          heapUsedEndMB: Number((p1MemEnd.heapUsed / 1048576).toFixed(2)),
          heapDeltaMB: Number(((p1MemEnd.heapUsed - p1MemStart.heapUsed) / 1048576).toFixed(2)),
        },
        slaPass: p1Failed === 0 && p1Stats.avgMs < 2000 && p1Stats.p99Ms < 2800,
      },
      prototype2: {
        description: "5,000 Applications (Phase 1 Outbox ACID) + worker-scoring (BLMOVE + LREM)",
        submit: {
          total: 5000,
          succeeded: submittedAppIds.length,
          failed: p2SubmitFailed,
          ...p2SubmitStats,
        },
        outboxDrained,
        scoring: {
          scoredCount,
          scoringErrors,
          durationSec: p2ScoreDurationSec,
          throughputAppsPerSec: p2ScoringThroughput,
          mainQueueRemaining,
          processingQueueRemaining,
          dlqCount,
          lostTasks: 5000 - scoredCount,
        },
        slaPass:
          p2SubmitFailed === 0 &&
          p2SubmitStats.p99Ms < 150 &&
          scoredCount === 5000 &&
          p2ScoringThroughput >= 50 &&
          mainQueueRemaining === 0 &&
          processingQueueRemaining === 0 &&
          dlqCount === 0,
      },
      prototype3: {
        searchCacheMiss: { ...missStats, verifiedMisses: missVerified, slaPass: missStats.p95Ms < 200 },
        searchCacheHit: { ...hitStats, verifiedHits: hitVerified, slaPass: hitStats.p95Ms < 50 },
        qdrantHnswRecommendation: {
          ...hnswStats,
          succeeded: hnswSucceeded,
          slaPass: hnswSucceeded === 100 && hnswStats.p95Ms < 50,
        },
        directCvJdMatch: {
          ...directStats,
          succeeded: directSucceeded,
          slaPass: directSucceeded === 20 && directStats.p95Ms < 1500,
        },
        bulkWrite500: {
          status: bulkResp.status,
          requestedCount: bulkIds.length,
          updatedCount: bulkUpdatedCount,
          durationMs: bulkDurationMs,
          slaPass: bulkResp.status === 200 && bulkUpdatedCount === 500 && bulkDurationMs < 1000,
        },
      },
    };

    const allPass =
      results.prototype1.slaPass &&
      results.prototype2.slaPass &&
      results.prototype3.searchCacheMiss.slaPass &&
      results.prototype3.searchCacheHit.slaPass &&
      results.prototype3.qdrantHnswRecommendation.slaPass &&
      results.prototype3.directCvJdMatch.slaPass &&
      results.prototype3.bulkWrite500.slaPass;

    results.overallPass = allPass;

    await fs.mkdir(path.join(ROOT_DIR, "docs"), { recursive: true });
    await fs.writeFile(
      path.join(ROOT_DIR, "docs", "benchmark-results.json"),
      JSON.stringify(results, null, 2),
      "utf8"
    );

    const md = [
      "# Kết quả Benchmark 3 Prototype — Hệ thống CV Matching Microservices",
      "",
      `- **Thời điểm đo:** ${results.generatedAt}`,
      `- **Chế độ thực thi:** \`${results.environment.mode}\` (${results.environment.nodeVersion}, ${results.environment.platform}/${results.environment.arch})`,
      "- **Lưu ý minh bạch:** Chế độ `embedded` chạy toàn bộ `api-gateway` + 8 Express microservices + `worker-scoring` qua HTTP cục bộ với in-memory Redis/Mongo/Qdrant/AI stubs; chạy `--mode=live --gateway=http://localhost:3001` để đo trên cụm Docker container thực tế.",
      "",
      "## Bảng tổng hợp SLA 3 Prototype",
      "",
      "| Hạng mục đo kiểm | Số lượng mẫu | Mục tiêu SLA | Kết quả đo thực tế | Trạng thái |",
      "| :--- | :---: | :---: | :--- | :---: |",
      `| **Prototype 1:** Upload + Parse + Embed + Vector | 500 CV | Avg < 2.0s, P99 < 2.8s | Avg **${results.prototype1.avgMs} ms**, P99 **${results.prototype1.p99Ms} ms** (${results.prototype1.throughputPerSec} req/s, Heap Δ ${results.prototype1.memory.heapDeltaMB} MB) | ${results.prototype1.slaPass ? "PASS" : "FAIL"} |`,
      `| **Prototype 2 (Pha 1):** Nộp đơn ACID Outbox | 5,000 đơn | P99 < 150 ms | P50 **${results.prototype2.submit.p50Ms} ms**, P99 **${results.prototype2.submit.p99Ms} ms** (${results.prototype2.submit.throughputPerSec} req/s) | ${results.prototype2.submit.p99Ms < 150 ? "PASS" : "FAIL"} |`,
      `| **Prototype 2 (Pha 2):** Worker Scoring \`BLMOVE\` | 5,000 đơn | >= 50 đơn/s, 0 thất lạc | **${results.prototype2.scoring.throughputAppsPerSec} đơn/s** (${results.prototype2.scoring.durationSec}s), thất lạc **${results.prototype2.scoring.lostTasks}**, DLQ **${results.prototype2.scoring.dlqCount}** | ${results.prototype2.slaPass ? "PASS" : "FAIL"} |`,
      `| **Prototype 3A:** Tìm kiếm Job (Cache Miss) | 50 truy vấn | P95 < 200 ms | Avg **${results.prototype3.searchCacheMiss.avgMs} ms**, P95 **${results.prototype3.searchCacheMiss.p95Ms} ms** | ${results.prototype3.searchCacheMiss.slaPass ? "PASS" : "FAIL"} |`,
      `| **Prototype 3A:** Tìm kiếm Job (Cache Hit) | 200 truy vấn | P95 < 50 ms | Avg **${results.prototype3.searchCacheHit.avgMs} ms**, P95 **${results.prototype3.searchCacheHit.p95Ms} ms** | ${results.prototype3.searchCacheHit.slaPass ? "PASS" : "FAIL"} |`,
      `| **Prototype 3B:** Gợi ý việc làm Qdrant HNSW (500 vectors) | 100 truy vấn | P95 < 50 ms | Avg **${results.prototype3.qdrantHnswRecommendation.avgMs} ms**, P95 **${results.prototype3.qdrantHnswRecommendation.p95Ms} ms** | ${results.prototype3.qdrantHnswRecommendation.slaPass ? "PASS" : "FAIL"} |`,
      `| **Prototype 3C:** Đánh giá trực tiếp CV-JD (\`optimize-cv\`) | 20 yêu cầu | P95 < 1,500 ms | Avg **${results.prototype3.directCvJdMatch.avgMs} ms**, P95 **${results.prototype3.directCvJdMatch.p95Ms} ms** | ${results.prototype3.directCvJdMatch.slaPass ? "PASS" : "FAIL"} |`,
      `| **Prototype 3D:** BulkWrite chuyển trạng thái | 500 đơn | < 1,000 ms | **${results.prototype3.bulkWrite500.durationMs} ms** (updated **${results.prototype3.bulkWrite500.updatedCount}/500**) | ${results.prototype3.bulkWrite500.slaPass ? "PASS" : "FAIL"} |`,
      "",
      `**Kết luận chung:** ${allPass ? "ĐẠT 100% SLA" : "CHƯA ĐẠT SLA"}`,
      "",
    ].join("\n");

    await fs.writeFile(path.join(ROOT_DIR, "docs", "BENCHMARK_RESULTS.md"), md, "utf8");
    console.log(JSON.stringify(results, null, 2));

    if (!allPass) {
      process.exitCode = 1;
    }
  } finally {
    if (cluster) {
      await cluster.close();
    }
  }
}

runBenchmark().catch((err) => {
  console.error("[benchmark-prototypes] Fatal error:", err);
  process.exit(1);
});
