import test from "node:test";
import assert from "node:assert/strict";
import { PUBSUB_CHANNELS, createRedisBus } from "@cvm/shared";
import { createApp } from "../src/app.js";

function createFakeRedis() {
  const store = new Map();
  const published = [];

  return {
    _store: store,
    _published: published,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async set(key, value) {
      store.set(key, String(value));
      return "OK";
    },
    async scan(_cursor, _matchKw, pattern) {
      const prefix = pattern.replace(/\*$/, "");
      const keys = [];
      for (const k of store.keys()) {
        if (k.startsWith(prefix)) keys.push(k);
      }
      return ["0", keys];
    },
    async del(...keys) {
      let count = 0;
      for (const k of keys) {
        if (store.delete(k)) count += 1;
      }
      return count;
    },
    async publish(channel, message) {
      published.push({ channel, payload: JSON.parse(message) });
      return 1;
    },
  };
}

function createInMemoryStore(prefix) {
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
    };
  }

  return {
    _docs: docs,
    async create(payload) {
      const id = `${prefix}-${seq++}`;
      const raw = {
        createdAt: new Date(),
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
        if (filter.ownerId && String(raw.ownerId) !== String(filter.ownerId)) continue;
        if (filter.taxCode && String(raw.taxCode) !== String(filter.taxCode)) continue;
        return wrap(raw);
      }
      return null;
    },
    async find(filter = {}) {
      const list = [];
      for (const raw of docs.values()) {
        if (filter.recruiterId && String(raw.recruiterId) !== String(filter.recruiterId)) continue;
        if (filter.status?.$ne && raw.status === filter.status.$ne) continue;
        if (filter.status?.$in && !filter.status.$in.includes(raw.status)) continue;
        if (typeof filter.status === "string" && raw.status !== filter.status) continue;
        list.push(wrap(raw));
      }
      return list;
    },
    async countDocuments(filter = {}) {
      return (await this.find(filter)).length;
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

test("Job service manages company MST verification, draft/publish Qdrant sync, Redis cache invalidation, and JOB_STATUS_CHANGED", async (t) => {
  const CompanyModel = createInMemoryStore("comp");
  const JobModel = createInMemoryStore("job");
  const fakeRedis = createFakeRedis();
  const redisBus = createRedisBus(fakeRedis);

  const minioObjects = new Map();
  const minioStorage = {
    async uploadObject({ bucket, objectKey, buffer, contentType }) {
      minioObjects.set(`${bucket}/${objectKey}`, { buffer, contentType });
      return { bucket, objectKey, size: buffer.length };
    },
  };

  let embedCallCount = 0;
  const embeddingClient = {
    async embedText() {
      embedCallCount += 1;
      return new Array(384).fill(0.02);
    },
  };

  const qdrantPoints = new Map();
  const vectorStore = {
    async upsertJobVector({ jobId, category, status, vector }) {
      qdrantPoints.set(jobId, {
        vector,
        payload: { mongoId: jobId, category, status },
      });
    },
    async deleteJobVector(jobId) {
      qdrantPoints.delete(jobId);
    },
  };

  const app = createApp({
    CompanyModel,
    JobModel,
    minioStorage,
    embeddingClient,
    vectorStore,
    redisBus,
    gatewaySecret: "gw-secret",
  });

  const { server, baseUrl } = await listenApp(app);
  t.after(() => server.close());

  const rec1Headers = {
    "x-gateway-secret": "gw-secret",
    "x-user-id": "rec-1",
    "x-user-role": "recruiter",
    "Content-Type": "application/json",
  };
  const rec2Headers = {
    "x-gateway-secret": "gw-secret",
    "x-user-id": "rec-2",
    "x-user-role": "recruiter",
    "Content-Type": "application/json",
  };
  const staffHeaders = {
    "x-gateway-secret": "gw-secret",
    "x-user-id": "staff-1",
    "x-user-role": "tech_staff",
    "Content-Type": "application/json",
  };

  // 1. Company creation, duplicate taxCode check (409), logo upload, and tech_staff verification
  const comp1 = await fetch(`${baseUrl}/api/company/me`, {
    method: "PUT",
    headers: rec1Headers,
    body: JSON.stringify({ name: "TDMU Tech JSC", taxCode: "3701234567" }),
  });
  assert.equal(comp1.status, 200);
  const comp1Data = (await comp1.json()).company;
  assert.equal(comp1Data.verificationStatus, "pending");

  const dupTax = await fetch(`${baseUrl}/api/company/me`, {
    method: "PUT",
    headers: rec2Headers,
    body: JSON.stringify({ name: "Copycat Corp", taxCode: "3701234567" }),
  });
  assert.equal(dupTax.status, 409);
  assert.equal((await dupTax.json()).error_code, "duplicate_tax_code");

  // Upload PNG logo
  const logoForm = new FormData();
  logoForm.append(
    "file",
    new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])], {
      type: "image/png",
    }),
    "logo.png"
  );
  const logoResp = await fetch(`${baseUrl}/api/company/me/logo`, {
    method: "POST",
    headers: {
      "x-gateway-secret": "gw-secret",
      "x-user-id": "rec-1",
      "x-user-role": "recruiter",
    },
    body: logoForm,
  });
  assert.equal(logoResp.status, 200);
  assert.ok(minioObjects.has(`company-assets-bucket/${comp1Data._id}/logo.png`));

  // Non-staff cannot verify company (403); tech_staff can verify (200)
  const forbiddenVerify = await fetch(`${baseUrl}/api/company/${comp1Data._id}/verify`, {
    method: "PATCH",
    headers: rec1Headers,
    body: JSON.stringify({ status: "verified" }),
  });
  assert.equal(forbiddenVerify.status, 403);

  const staffVerify = await fetch(`${baseUrl}/api/company/${comp1Data._id}/verify`, {
    method: "PATCH",
    headers: staffHeaders,
    body: JSON.stringify({ status: "verified", note: "MST verified" }),
  });
  assert.equal(staffVerify.status, 200);
  assert.equal((await staffVerify.json()).company.verificationStatus, "verified");

  // 2. Draft job does NOT embed or upsert Qdrant
  const draftResp = await fetch(`${baseUrl}/api/jobs`, {
    method: "POST",
    headers: rec1Headers,
    body: JSON.stringify({
      title: "Draft Backend Engineer",
      description: "Internal draft JD",
      status: "draft",
    }),
  });
  assert.equal(draftResp.status, 201);
  assert.equal(embedCallCount, 0);
  assert.equal(qdrantPoints.size, 0);

  // 3. Seed Redis jobs:cache:* and publish active job -> embeds, upserts Qdrant, invalidates cache
  await fakeRedis.set("jobs:cache:search1", JSON.stringify({ jobs: [] }));
  await fakeRedis.set("jobs:cache:search2", JSON.stringify({ jobs: [] }));

  const activeResp = await fetch(`${baseUrl}/api/jobs`, {
    method: "POST",
    headers: rec1Headers,
    body: JSON.stringify({
      title: "Senior Node.js Engineer",
      description: "Build microservices with MongoDB and Redis",
      category: "backend",
      skills: ["Node.js", "MongoDB", "Redis"],
      status: "active",
    }),
  });
  assert.equal(activeResp.status, 201);
  const activeJob = (await activeResp.json()).job;
  assert.equal(embedCallCount, 1);
  assert.deepEqual(qdrantPoints.get(String(activeJob._id))?.payload, {
    mongoId: String(activeJob._id),
    category: "backend",
    status: "active",
  });
  assert.equal(fakeRedis._store.has("jobs:cache:search1"), false);
  assert.equal(fakeRedis._store.has("jobs:cache:search2"), false);

  // 4. Close job -> deletes Qdrant vector and publishes JOB_STATUS_CHANGED
  const closeResp = await fetch(`${baseUrl}/api/jobs/${activeJob._id}/close`, {
    method: "POST",
    headers: rec1Headers,
  });
  assert.equal(closeResp.status, 200);
  assert.equal((await closeResp.json()).job.status, "closed");
  assert.equal(qdrantPoints.has(String(activeJob._id)), false);
  assert.equal(fakeRedis._published.length, 1);
  assert.equal(fakeRedis._published[0].channel, PUBSUB_CHANNELS.JOB_STATUS_CHANGED);
  assert.equal(fakeRedis._published[0].payload.jobId, String(activeJob._id));
  assert.equal(fakeRedis._published[0].payload.status, "closed");
});
