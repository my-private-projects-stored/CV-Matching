import test from "node:test";
import assert from "node:assert/strict";
import { PUBSUB_CHANNELS, createRedisBus } from "@cvm/shared";
import { createApp } from "../src/app.js";

function createFakeRedis() {
  const lists = new Map();
  const published = [];

  function getList(key) {
    if (!lists.has(key)) lists.set(key, []);
    return lists.get(key);
  }

  return {
    _lists: lists,
    _published: published,
    async ping() {
      return "PONG";
    },
    async llen(key) {
      return getList(key).length;
    },
    async lrange(key, start, stop) {
      const list = getList(key);
      const end = stop < 0 ? list.length + 1 + stop : stop + 1;
      return list.slice(start, end);
    },
    async lpush(key, val) {
      const list = getList(key);
      list.unshift(String(val));
      return list.length;
    },
    async rpop(key) {
      const list = getList(key);
      return list.length > 0 ? list.pop() : null;
    },
    async publish(channel, message) {
      published.push({ channel, payload: JSON.parse(message) });
      return 1;
    },
  };
}

function createInMemoryConfigStore() {
  const docs = new Map();
  return {
    async findOne({ key }) {
      return docs.get(key) || null;
    },
    async findOneAndUpdate({ key }, update) {
      const doc = { key, value: update.$set.value, updatedAt: new Date() };
      docs.set(key, doc);
      return doc;
    },
  };
}

function createInMemoryAuditStore() {
  const logs = [];
  return {
    _logs: logs,
    async create(doc) {
      const created = { _id: `audit-${logs.length + 1}`, createdAt: new Date(), ...doc };
      logs.unshift(created);
      return created;
    },
    async find(filter = {}, opts = {}) {
      let list = logs.filter((l) => (!filter.action ? true : l.action === filter.action));
      if (opts.limit) list = list.slice(0, opts.limit);
      return list;
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

test("Config & Analytics service handles scoringWeights hot-reload, cluster health, DLQ retry, zero-downtime Qdrant alias swap, and Owner BI", async (t) => {
  const fakeRedis = createFakeRedis();
  const redisBus = createRedisBus(fakeRedis);
  const SystemConfigModel = createInMemoryConfigStore();
  const AuditLogModel = createInMemoryAuditStore();

  // Mock Qdrant with active alias tracking for concurrent zero-error search verification
  let activeAliasTarget = "resumes_vectors_v0";
  const collections = new Map([["resumes_vectors_v0", []]]);
  const qdrantClient = {
    async createCollection(name) {
      collections.set(name, []);
    },
    async upsert(name, { points }) {
      const arr = collections.get(name) || [];
      arr.push(...points);
      collections.set(name, arr);
    },
    async updateCollectionAliases({ actions }) {
      for (const act of actions) {
        if (act.create_alias) {
          activeAliasTarget = act.create_alias.collection_name;
        }
      }
    },
    async searchAlias(aliasName) {
      if (aliasName === "resumes_vectors" && collections.has(activeAliasTarget)) {
        return { ok: true, target: activeAliasTarget };
      }
      throw new Error("Alias broken");
    },
  };

  const embeddingClient = {
    async embedText() {
      return new Array(384).fill(0.01);
    },
  };

  // 150 records -> 2 batches (100 + 50)
  const fakeRecords = Array.from({ length: 150 }, (_, i) => ({
    id: `res-${i + 1}`,
    text: `Resume text ${i + 1}`,
    payload: { mongoId: `res-${i + 1}`, candidateId: `cand-${i + 1}`, isAnalyzed: true },
  }));
  const recordLoader = async (_target, offset, limit) => fakeRecords.slice(offset, offset + limit);

  const analyticsProvider = {
    async loadSnapshot() {
      return {
        users: [
          { role: "candidate", createdAt: new Date() },
          { role: "recruiter", createdAt: new Date() },
        ],
        resumes: [{ createdAt: new Date() }],
        jobs: [{ status: "active", category: "backend", createdAt: new Date() }],
        applications: [
          { status: "hired", aiScores: { hybridScore: 0.88 }, createdAt: new Date() },
          { status: "interview", aiScores: { hybridScore: 0.82 }, createdAt: new Date() },
          { status: "rejected", aiScores: { hybridScore: 0.35 }, createdAt: new Date() },
        ],
      };
    },
  };

  const app = createApp({
    SystemConfigModel,
    AuditLogModel,
    redisClient: fakeRedis,
    redisBus,
    qdrantClient,
    embeddingClient,
    recordLoader,
    analyticsProvider,
    clusterTargets: {
      services: [{ name: "auth-service", url: "up" }, { name: "resume-service", url: "down" }],
      workers: [{ name: "worker-scoring", url: "up" }],
      datastores: [{ name: "redis", url: "up" }],
    },
    probeFn: async (target) => ({
      name: target.name,
      status: target.url === "down" ? "down" : "up",
      latency_ms: 3,
    }),
    gatewaySecret: "gw-secret",
  });

  const { server, baseUrl } = await listenApp(app);
  t.after(() => server.close());

  const staffHeaders = {
    "x-gateway-secret": "gw-secret",
    "x-user-id": "staff-1",
    "x-user-role": "tech_staff",
    "Content-Type": "application/json",
  };
  const ownerHeaders = {
    "x-gateway-secret": "gw-secret",
    "x-user-id": "owner-1",
    "x-user-role": "platform_owner",
  };
  const candHeaders = {
    "x-gateway-secret": "gw-secret",
    "x-user-id": "cand-1",
    "x-user-role": "candidate",
    "Content-Type": "application/json",
  };

  // 1. scoringWeights validation & CONFIG_UPDATED hot-reload
  const badWeights = await fetch(`${baseUrl}/api/config/scoring-weights`, {
    method: "PUT",
    headers: staffHeaders,
    body: JSON.stringify({ semanticWeight: 0.6, keywordWeight: 0.6 }),
  });
  assert.equal(badWeights.status, 400);

  const okWeights = await fetch(`${baseUrl}/api/config/scoring-weights`, {
    method: "PUT",
    headers: staffHeaders,
    body: JSON.stringify({ semanticWeight: 0.7, keywordWeight: 0.3 }),
  });
  assert.equal(okWeights.status, 200);
  assert.ok(fakeRedis._published.some((e) => e.channel === PUBSUB_CHANNELS.CONFIG_UPDATED));

  // 2. Cluster health probe (< 1s) & RBAC guard
  const healthForbidden = await fetch(`${baseUrl}/api/config-analytics/health/cluster`, {
    headers: candHeaders,
  });
  assert.equal(healthForbidden.status, 403);

  const healthResp = await fetch(`${baseUrl}/api/config-analytics/health/cluster`, {
    headers: staffHeaders,
  });
  assert.equal(healthResp.status, 200);
  const healthData = await healthResp.json();
  assert.equal(healthData.status, "degraded");
  assert.ok(healthData.total_latency_ms < 1000);

  // 3. DLQ inspection & retry resets retry_count = 0 and logs AuditLog
  await fakeRedis.lpush(
    "application_scoring_queue_dlq",
    JSON.stringify({ application_id: "app-dlq-1", retry_count: 4, dead_lettered_at: "2026-11-24T00:00:00Z" })
  );
  const qSnap = await (await fetch(`${baseUrl}/api/config-analytics/queues`, { headers: staffHeaders })).json();
  assert.equal(qSnap.depths.application_scoring_queue_dlq, 1);

  const retryResp = await fetch(`${baseUrl}/api/config-analytics/queues/retry`, {
    method: "POST",
    headers: staffHeaders,
    body: JSON.stringify({ dlqName: "application_scoring_queue_dlq", count: 5 }),
  });
  assert.equal(retryResp.status, 200);
  assert.equal((await retryResp.json()).retriedCount, 1);
  assert.equal((fakeRedis._lists.get("application_scoring_queue") || []).length, 1);
  const retriedPayload = JSON.parse(fakeRedis._lists.get("application_scoring_queue")[0]);
  assert.equal(retriedPayload.retry_count, 0);

  // 4. Qdrant Alias Swap reindex concurrently with searches -> 0% errors & < 10ms swap
  let searchErrors = 0;
  const searchLoop = (async () => {
    for (let i = 0; i < 20; i += 1) {
      try {
        await qdrantClient.searchAlias("resumes_vectors");
      } catch {
        searchErrors += 1;
      }
      await new Promise((r) => setTimeout(r, 2));
    }
  })();

  const reindexResp = await fetch(`${baseUrl}/api/config-analytics/vector/reindex`, {
    method: "POST",
    headers: staffHeaders,
    body: JSON.stringify({ target: "resumes", batchSize: 100 }),
  });
  await searchLoop;
  assert.equal(reindexResp.status, 200);
  const reindexData = await reindexResp.json();
  assert.equal(reindexData.reindexedCount, 150);
  assert.equal(reindexData.batches, 2);
  assert.ok(reindexData.alias_swap_ms < 10);
  assert.equal(searchErrors, 0);

  // 5. PLATFORM_OWNER BI Analytics & RBAC enforcement
  const ownerDenied = await fetch(`${baseUrl}/api/config-analytics/analytics/overview`, {
    headers: candHeaders,
  });
  assert.equal(ownerDenied.status, 403);

  const overview = await (
    await fetch(`${baseUrl}/api/config-analytics/analytics/overview?range=30d`, { headers: ownerHeaders })
  ).json();
  assert.equal(overview.kpis.totalUsers, 2);
  assert.equal(overview.kpis.totalApplications, 3);

  const funnel = await (
    await fetch(`${baseUrl}/api/config-analytics/analytics/funnel?range=30d`, { headers: ownerHeaders })
  ).json();
  assert.equal(funnel.aiCorrelation.highScoreGroup.count, 2);
  assert.equal(funnel.aiCorrelation.highScoreGroup.hireRate, 50);
  assert.equal(funnel.aiCorrelation.lowScoreGroup.hireRate, 0);

  const csvResp = await fetch(`${baseUrl}/api/config-analytics/analytics/export?range=30d`, {
    headers: ownerHeaders,
  });
  assert.equal(csvResp.status, 200);
  assert.ok((await csvResp.text()).includes("high_score_hire_rate_pct,50"));
});
