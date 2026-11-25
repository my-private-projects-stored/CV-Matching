import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

function createInMemoryResumeStore() {
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
      const id = String(payload._id || `res-${seq++}`);
      const raw = {
        versions: [],
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
    async find(filter = {}) {
      const list = [];
      for (const raw of docs.values()) {
        if (filter.candidateId && String(raw.candidateId) !== String(filter.candidateId)) continue;
        list.push(wrap(raw));
      }
      return list;
    },
    async updateMany(filter = {}, update = {}) {
      for (const raw of docs.values()) {
        if (filter.candidateId && String(raw.candidateId) !== String(filter.candidateId)) continue;
        if (update.$set) Object.assign(raw, update.$set);
      }
    },
    async deleteOne(filter = {}) {
      docs.delete(String(filter._id));
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

test("Resume service validates Magic Bytes, size limit, MinIO upload, Qdrant sync, retry queue, and anti-IDOR", async (t) => {
  const ResumeModel = createInMemoryResumeStore();
  const minioObjects = new Map();
  const qdrantPoints = new Map();
  const retryQueue = [];

  const minioStorage = {
    async uploadObject({ bucket, objectKey, buffer, contentType }) {
      minioObjects.set(`${bucket}/${objectKey}`, { buffer, contentType });
      return { bucket, objectKey, size: buffer.length };
    },
    async getObjectBuffer(bucket, objectKey) {
      return minioObjects.get(`${bucket}/${objectKey}`)?.buffer;
    },
    async deleteObject(bucket, objectKey) {
      minioObjects.delete(`${bucket}/${objectKey}`);
    },
    async getPresignedDownloadUrl(bucket, objectKey, ttl) {
      return `http://minio.local/${bucket}/${objectKey}?X-Amz-Expires=${ttl}`;
    },
  };

  let shouldFailParsing = false;
  const parsingClient = {
    async extractRawTextFromFile() {
      if (shouldFailParsing) throw new Error("Parsing worker timed out");
      return "Experienced Node.js and MongoDB Engineer";
    },
  };

  const embeddingClient = {
    async embedText() {
      return new Array(384).fill(0.05);
    },
  };

  const vectorStore = {
    async upsertResumeVector({ resumeId, candidateId, isAnalyzed, vector }) {
      qdrantPoints.set(resumeId, {
        vector,
        payload: { mongoId: resumeId, candidateId, isAnalyzed },
      });
    },
    async deleteResumeVector(resumeId) {
      qdrantPoints.delete(resumeId);
    },
  };

  const redisClient = {
    async lpush(_key, value) {
      retryQueue.push(JSON.parse(value));
      return retryQueue.length;
    },
  };

  const app = createApp({
    ResumeModel,
    minioStorage,
    parsingClient,
    embeddingClient,
    vectorStore,
    redisClient,
    gatewaySecret: "gw-secret",
    canRecruiterAccessResume: async (recruiterId) => recruiterId === "rec-authorized",
  });

  const { server, baseUrl } = await listenApp(app);
  t.after(() => server.close());

  const candAHeaders = {
    "x-gateway-secret": "gw-secret",
    "x-user-id": "cand-a",
    "x-user-role": "candidate",
  };

  // 1. Spoofed .exe renamed to fake.pdf must be blocked by Magic Bytes (400) before MinIO
  const spoofForm = new FormData();
  spoofForm.append(
    "file",
    new Blob([Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03])], { type: "application/pdf" }),
    "fake.pdf"
  );
  const spoofResp = await fetch(`${baseUrl}/api/resumes/upload`, {
    method: "POST",
    headers: candAHeaders,
    body: spoofForm,
  });
  assert.equal(spoofResp.status, 400);
  assert.equal((await spoofResp.json()).error_code, "invalid_file_signature");
  assert.equal(minioObjects.size, 0);

  // 2. Oversized > 4MB file must be rejected with 413
  const bigForm = new FormData();
  const bigBuf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(4 * 1024 * 1024 + 100, 0x41)]);
  bigForm.append("file", new Blob([bigBuf], { type: "application/pdf" }), "huge.pdf");
  const bigResp = await fetch(`${baseUrl}/api/resumes/upload`, {
    method: "POST",
    headers: candAHeaders,
    body: bigForm,
  });
  assert.equal(bigResp.status, 413);
  assert.equal((await bigResp.json()).error_code, "uploaded_file_too_large");

  // 3. Valid PDF uploads to MinIO, parses, embeds, and upserts exact Qdrant payload
  const okForm = new FormData();
  okForm.append(
    "file",
    new Blob([Buffer.from("%PDF-1.4\nValid Resume Content")], { type: "application/pdf" }),
    "resume.pdf"
  );
  okForm.append("title", "Backend CV");
  const okResp = await fetch(`${baseUrl}/api/resumes/upload`, {
    method: "POST",
    headers: candAHeaders,
    body: okForm,
  });
  assert.equal(okResp.status, 201);
  const okBody = await okResp.json();
  assert.equal(okBody.queuedForRetry, false);
  assert.equal(okBody.resume.processingStatus, "completed");
  assert.ok(okBody.resume.fileUrl.startsWith("cand-a/"));
  assert.ok(minioObjects.has(`resumes-bucket/${okBody.resume.fileUrl}`));

  const qdrantEntry = qdrantPoints.get(String(okBody.resume._id));
  assert.ok(qdrantEntry);
  assert.deepEqual(qdrantEntry.payload, {
    mongoId: String(okBody.resume._id),
    candidateId: "cand-a",
    isAnalyzed: true,
  });

  // 4. Worker parsing timeout sets processingStatus=pending and enqueues Redis retry job
  shouldFailParsing = true;
  const retryForm = new FormData();
  retryForm.append(
    "file",
    new Blob([Buffer.from("%PDF-1.4\nDeferred Resume")], { type: "application/pdf" }),
    "deferred.pdf"
  );
  const retryResp = await fetch(`${baseUrl}/api/resumes/upload`, {
    method: "POST",
    headers: candAHeaders,
    body: retryForm,
  });
  assert.equal(retryResp.status, 201);
  const retryBody = await retryResp.json();
  assert.equal(retryBody.queuedForRetry, true);
  assert.equal(retryBody.resume.processingStatus, "pending");
  assert.equal(retryQueue.length, 1);

  // 5. Anti-IDOR on GET /:id/download
  const resumeId = String(okBody.resume._id);
  const candBResp = await fetch(`${baseUrl}/api/resumes/${resumeId}/download`, {
    headers: { "x-gateway-secret": "gw-secret", "x-user-id": "cand-b", "x-user-role": "candidate" },
  });
  assert.equal(candBResp.status, 403);

  const unauthRecResp = await fetch(`${baseUrl}/api/resumes/${resumeId}/download`, {
    headers: { "x-gateway-secret": "gw-secret", "x-user-id": "rec-other", "x-user-role": "recruiter" },
  });
  assert.equal(unauthRecResp.status, 403);

  const authRecResp = await fetch(`${baseUrl}/api/resumes/${resumeId}/download`, {
    headers: { "x-gateway-secret": "gw-secret", "x-user-id": "rec-authorized", "x-user-role": "recruiter" },
  });
  assert.equal(authRecResp.status, 200);
  const dlData = await authRecResp.json();
  assert.equal(dlData.expiresInSeconds, 900);
  assert.ok(dlData.downloadUrl.includes("resumes-bucket/"));

  // 6. Resume Builder update records version snapshot and re-syncs Qdrant vector
  const updateResp = await fetch(`${baseUrl}/api/resumes/${resumeId}`, {
    method: "PUT",
    headers: { ...candAHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Backend CV v2",
      rawText: "Senior Distributed Systems Engineer",
    }),
  });
  assert.equal(updateResp.status, 200);
  const updated = await updateResp.json();
  assert.equal(updated.resume.versions.length, 1);
  assert.equal(updated.resume.vectorStale, false);
});
