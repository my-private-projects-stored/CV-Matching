import test from "node:test";
import assert from "node:assert/strict";
import { createRedisBus } from "@cvm/shared";
import { createApp } from "../src/app.js";

function createFakeRedis() {
  const store = new Map();
  return {
    _store: store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async set(key, value) {
      store.set(key, String(value));
      return "OK";
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

test("Recommendation service implements Redis Cache-Aside, Qdrant HNSW matching, and 1.5s keyword fallback", async (t) => {
  const fakeRedis = createFakeRedis();
  const redisBus = createRedisBus(fakeRedis);

  const sampleJobs = [
    {
      _id: "job-1",
      title: "Senior Node.js Backend Engineer",
      companyName: "TDMU Tech",
      category: "backend",
      location: "Ho Chi Minh",
      skills: ["Node.js", "MongoDB", "Redis", "Docker"],
      description: "Build microservices with Node.js, MongoDB, and Redis",
    },
    {
      _id: "job-2",
      title: "Digital Marketing Specialist",
      companyName: "Brand Co",
      category: "marketing",
      location: "Ha Noi",
      skills: ["SEO", "Content"],
      description: "SEO and social media campaigns",
    },
  ];

  const sampleResumes = [
    {
      _id: "res-1",
      candidateId: "cand-1",
      title: "Node.js CV",
      rawText: "5 years building Node.js microservices with MongoDB and Redis",
      parsedData: { skills: ["Node.js", "MongoDB", "Redis"] },
    },
  ];

  let catalogListCalls = 0;
  const jobCatalogClient = {
    async listActiveJobs() {
      catalogListCalls += 1;
      return {
        jobs: sampleJobs,
        pagination: { page: 1, limit: 20, total: sampleJobs.length },
      };
    },
    async getJobById(id) {
      return sampleJobs.find((j) => j._id === id) || null;
    },
  };

  const resumeCatalogClient = {
    async getResumeById(id) {
      return sampleResumes.find((r) => r._id === id) || null;
    },
    async listCandidateResumes() {
      return sampleResumes;
    },
  };

  let qdrantMode = "healthy";
  const qdrantClient = {
    async retrieve() {
      if (qdrantMode === "down") throw new Error("ECONNREFUSED Qdrant");
      if (qdrantMode === "timeout") {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return [{ vector: new Array(384).fill(0.1) }];
    },
    async search(collection) {
      if (qdrantMode === "down") throw new Error("ECONNREFUSED Qdrant");
      if (qdrantMode === "timeout") {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (collection === "jobs_vectors") {
        return [{ score: 0.88, payload: { mongoId: "job-1", category: "backend", status: "active" } }];
      }
      return [{ score: 0.86, payload: { mongoId: "res-1", candidateId: "cand-1", isAnalyzed: true } }];
    },
  };

  const app = createApp({
    qdrantClient,
    redisBus,
    jobCatalogClient,
    resumeCatalogClient,
    qdrantTimeoutMs: 60,
    gatewaySecret: "gw-secret",
  });

  const { server, baseUrl } = await listenApp(app);
  t.after(() => server.close());

  const candHeaders = {
    "x-gateway-secret": "gw-secret",
    "x-user-id": "cand-1",
    "x-user-role": "candidate",
  };
  const recHeaders = {
    "x-gateway-secret": "gw-secret",
    "x-user-id": "rec-1",
    "x-user-role": "recruiter",
  };

  // 1. Redis Cache-Aside: 1st miss -> 2nd hit (< 50ms)
  const s1 = await fetch(`${baseUrl}/api/recommendations/search?q=node&category=backend`);
  assert.equal(s1.status, 200);
  const d1 = await s1.json();
  assert.equal(d1.cache_hit, false);
  assert.equal(catalogListCalls, 1);

  const s2 = await fetch(`${baseUrl}/api/recommendations/search?q=node&category=backend`);
  assert.equal(s2.status, 200);
  const d2 = await s2.json();
  assert.equal(d2.cache_hit, true);
  assert.equal(catalogListCalls, 1);
  assert.ok(d2.latency_ms < 50);

  // 2. Healthy Qdrant HNSW job recommendation
  const rHealthy = await fetch(`${baseUrl}/api/recommendations/jobs?resume_id=res-1`, {
    headers: candHeaders,
  });
  assert.equal(rHealthy.status, 200);
  const dHealthy = await rHealthy.json();
  assert.equal(dHealthy.fallback_mode, null);
  assert.equal(dHealthy.source, "qdrant_hnsw");
  assert.equal(dHealthy.recommendations[0].job_id, "job-1");
  assert.ok(dHealthy.recommendations[0].hybrid_score > 0.7);

  // 3. Qdrant outage -> graceful keyword fallback (HTTP 200, fallback_mode: "keyword")
  qdrantMode = "down";
  const rDown = await fetch(`${baseUrl}/api/recommendations/jobs?resume_id=res-1`, {
    headers: candHeaders,
  });
  assert.equal(rDown.status, 200);
  const dDown = await rDown.json();
  assert.equal(dDown.fallback_mode, "keyword");
  assert.equal(dDown.recommendations[0].job_id, "job-1");

  // 4. Qdrant timeout (> qdrantTimeoutMs) -> graceful keyword fallback for recruiter resume search
  qdrantMode = "timeout";
  const rTimeout = await fetch(`${baseUrl}/api/recommendations/resumes?job_id=job-1`, {
    headers: recHeaders,
  });
  assert.equal(rTimeout.status, 200);
  const dTimeout = await rTimeout.json();
  assert.equal(dTimeout.fallback_mode, "keyword");
  assert.equal(dTimeout.recommendations[0].resume_id, "res-1");
});
