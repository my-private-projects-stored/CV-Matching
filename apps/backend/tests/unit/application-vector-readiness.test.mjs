import test from "node:test";
import assert from "node:assert/strict";

import {
  ensureVectorsReadyForScoring,
  VectorReadinessError,
} from "../../src/services/application-vector-readiness.service.js";

function createDoc(fields = {}) {
  return {
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
      return this;
    },
    ...fields,
  };
}

test("ensureVectorsReadyForScoring indexes missing job and resume vectors", async () => {
  const job = createDoc({
    _id: "job-1",
    status: "active",
    title: "Backend Engineer",
    cleanText: "Node.js MongoDB Qdrant",
    category: "IT",
    isAnalyzed: false,
  });
  const resume = createDoc({
    _id: "resume-1",
    candidateId: "candidate-1",
    rawText: "Node.js MongoDB",
    processingStatus: "processing",
    isAnalyzed: false,
  });
  const upserts = { jobs: [], resumes: [] };
  const deps = {
    findJobById: async () => job,
    findResumeById: async () => resume,
    getJobVectorPoint: async () => null,
    getResumeVectorPoint: async () => null,
    generateEmbedding: async () => [1, 0, 0],
    upsertJobVector: async (payload) => {
      upserts.jobs.push(payload);
    },
    upsertResumeVector: async (payload) => {
      upserts.resumes.push(payload);
    },
  };

  const result = await ensureVectorsReadyForScoring(
    { jobId: "job-1", resumeId: "resume-1" },
    { deps, timeoutMs: 50 }
  );

  assert.equal(result.jobId, "job-1");
  assert.equal(result.resumeId, "resume-1");
  assert.ok(result.jobQdrantId);
  assert.ok(result.resumeQdrantId);
  assert.equal(job.isAnalyzed, true);
  assert.equal(resume.isAnalyzed, true);
  assert.equal(resume.processingStatus, "ready");
  assert.equal(job.saveCalls, 1);
  assert.equal(resume.saveCalls, 1);
  assert.equal(upserts.jobs.length, 1);
  assert.equal(upserts.resumes.length, 1);
  assert.equal(upserts.resumes[0].payload.isAnalyzed, true);
});

test("ensureVectorsReadyForScoring times out as retryable vectors_not_ready", async () => {
  const never = () => new Promise(() => undefined);
  await assert.rejects(
    ensureVectorsReadyForScoring(
      { jobId: "job-1", resumeId: "resume-1" },
      {
        timeoutMs: 5,
        deps: {
          findJobById: never,
          findResumeById: never,
        },
      }
    ),
    (error) => {
      assert.ok(error instanceof VectorReadinessError);
      assert.equal(error.code, "vectors_not_ready");
      assert.equal(error.retryable, true);
      assert.equal(error.statusCode, 503);
      return true;
    }
  );
});

test("ensureVectorsReadyForScoring marks missing resources as non-retryable", async () => {
  await assert.rejects(
    ensureVectorsReadyForScoring(
      { jobId: "missing-job", resumeId: "resume-1" },
      {
        timeoutMs: 50,
        deps: {
          findJobById: async () => null,
          findResumeById: async () => createDoc({ _id: "resume-1" }),
        },
      }
    ),
    (error) => {
      assert.ok(error instanceof VectorReadinessError);
      assert.equal(error.code, "resource_not_found");
      assert.equal(error.retryable, false);
      assert.equal(error.statusCode, 404);
      return true;
    }
  );
});

test("ensureVectorsReadyForScoring classifies Qdrant failures for retry", async () => {
  const job = createDoc({
    _id: "job-1",
    qdrantId: "job-qdrant",
    status: "active",
    isAnalyzed: true,
    cleanText: "Node.js",
  });
  const resume = createDoc({
    _id: "resume-1",
    qdrantId: "resume-qdrant",
    candidateId: "candidate-1",
    rawText: "Node.js",
    isAnalyzed: true,
  });

  await assert.rejects(
    ensureVectorsReadyForScoring(
      { jobId: "job-1", resumeId: "resume-1" },
      {
        timeoutMs: 50,
        deps: {
          findJobById: async () => job,
          findResumeById: async () => resume,
          getJobVectorPoint: async () => {
            throw new Error("Qdrant unavailable");
          },
          getResumeVectorPoint: async () => ({ id: "resume-qdrant" }),
        },
      }
    ),
    (error) => {
      assert.ok(error instanceof VectorReadinessError);
      assert.equal(error.code, "qdrant_unavailable");
      assert.equal(error.retryable, true);
      assert.equal(error.statusCode, 503);
      return true;
    }
  );
});

test("ensureVectorsReadyForScoring treats vector dimension mismatch as non-retryable", async () => {
  const job = createDoc({
    _id: "job-1",
    status: "active",
    title: "Backend Engineer",
    cleanText: "Node.js",
    category: "IT",
    isAnalyzed: false,
  });
  const resume = createDoc({
    _id: "resume-1",
    candidateId: "candidate-1",
    rawText: "Node.js",
    isAnalyzed: false,
  });

  await assert.rejects(
    ensureVectorsReadyForScoring(
      { jobId: "job-1", resumeId: "resume-1" },
      {
        timeoutMs: 50,
        deps: {
          findJobById: async () => job,
          findResumeById: async () => resume,
          getJobVectorPoint: async () => null,
          getResumeVectorPoint: async () => null,
          generateEmbedding: async () => [1, 0, 0],
          upsertJobVector: async () => {
            throw new Error("Vector dimension must be 384");
          },
          upsertResumeVector: async () => undefined,
        },
      }
    ),
    (error) => {
      assert.ok(error instanceof VectorReadinessError);
      assert.equal(error.code, "vector_dim_mismatch");
      assert.equal(error.retryable, false);
      assert.equal(error.statusCode, 422);
      return true;
    }
  );
});
