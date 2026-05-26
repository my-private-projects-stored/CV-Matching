import Job from "../models/Job.js";
import Resume from "../models/Resume.js";
import { ENSURE_INDEX_TIMEOUT_MS } from "../constants/scoring.js";
import { ensureQdrantId } from "../utils/qdrant-id.js";
import { generateEmbedding } from "./embedding.service.js";
import {
  getJobVectorPoint,
  getResumeVectorPoint,
  upsertJobVector,
  upsertResumeVector,
} from "./vector-index.service.js";

export class VectorReadinessError extends Error {
  constructor(message, code, cause, options = {}) {
    super(message);
    this.name = "VectorReadinessError";
    this.code = code;
    this.error_code = code;
    this.statusCode = options.statusCode || 503;
    this.retryable = options.retryable !== false;
    this.cause = cause;
  }
}

const defaultDeps = {
  findJobById: (jobId) => Job.findById(jobId),
  findResumeById: (resumeId) => Resume.findById(resumeId),
  generateEmbedding,
  getJobVectorPoint,
  getResumeVectorPoint,
  upsertJobVector,
  upsertResumeVector,
};

function withTimeout(operation, timeoutMs, code) {
  const controller = new AbortController();
  let timer;
  return Promise.race([
    operation(controller.signal).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new VectorReadinessError("Vector readiness timed out", code));
      }, timeoutMs);
    }),
  ]);
}

function extractJobEmbeddingText(job) {
  if (job.cleanText && String(job.cleanText).trim()) {
    return String(job.cleanText);
  }

  return [job.title, job.description, job.requirements, job.benefits].filter(Boolean).join("\n");
}

function extractResumeEmbeddingText(resume) {
  if (resume.rawText && String(resume.rawText).trim()) {
    return String(resume.rawText);
  }

  return JSON.stringify(resume.parsedData || {});
}

async function hasJobPoint(job, deps) {
  if (!job?.qdrantId) {
    return false;
  }

  const point = await deps.getJobVectorPoint(job.qdrantId, { withVector: false });
  return Boolean(point);
}

async function hasResumePoint(resume, deps) {
  if (!resume?.qdrantId) {
    return false;
  }

  const point = await deps.getResumeVectorPoint(resume.qdrantId, { withVector: false });
  return Boolean(point);
}

async function ensureJobVector(job, deps, signal) {
  ensureQdrantId(job);
  if (job.isAnalyzed && (await hasJobPoint(job, deps))) {
    return job;
  }

  const text = extractJobEmbeddingText(job);
  if (!text.trim()) {
    throw new VectorReadinessError("Job has no text content to embed", "job_text_missing", null, {
      statusCode: 422,
      retryable: false,
    });
  }

  const vector = await deps.generateEmbedding(text, { signal });
  await deps.upsertJobVector({
    qdrantId: job.qdrantId,
    vector,
    payload: {
      mongoId: String(job._id),
      category: job.category,
      status: job.status,
    },
  });

  job.isAnalyzed = true;
  await job.save();
  return job;
}

async function ensureResumeVector(resume, deps, signal) {
  ensureQdrantId(resume);
  if (resume.isAnalyzed && (await hasResumePoint(resume, deps))) {
    return resume;
  }

  const text = extractResumeEmbeddingText(resume);
  if (!text.trim()) {
    throw new VectorReadinessError("Resume has no text content to embed", "resume_text_missing", null, {
      statusCode: 422,
      retryable: false,
    });
  }

  const vector = await deps.generateEmbedding(text, { signal });
  await deps.upsertResumeVector({
    qdrantId: resume.qdrantId,
    vector,
    payload: {
      mongoId: String(resume._id),
      candidateId: String(resume.candidateId),
      isAnalyzed: true,
    },
  });

  resume.isAnalyzed = true;
  if (resume.processingStatus === "pending" || resume.processingStatus === "processing") {
    resume.processingStatus = "ready";
  }
  await resume.save();
  return resume;
}

function classifyReadinessError(error) {
  const message = String(error?.message || "");
  if (/dimension|vector size/i.test(message)) {
    return "vector_dim_mismatch";
  }
  if (/qdrant/i.test(message)) {
    return "qdrant_unavailable";
  }
  if (/fetch|network|timeout|connect|econn|embedding/i.test(message)) {
    return "embedding_service_unavailable";
  }
  return "vectors_not_ready";
}

export async function ensureVectorsReadyForScoring(
  { jobId, resumeId },
  { timeoutMs = ENSURE_INDEX_TIMEOUT_MS, deps = defaultDeps } = {}
) {
  return withTimeout(
    (signal) => (async () => {
      const [job, resume] = await Promise.all([
        deps.findJobById(jobId),
        deps.findResumeById(resumeId),
      ]);
      if (!job || !resume) {
        throw new VectorReadinessError(
          "Job or Resume not found for vector readiness",
          "resource_not_found",
          null,
          { statusCode: 404, retryable: false }
        );
      }

      if (job.status !== "active") {
        throw new VectorReadinessError("Job is not active for scoring", "job_not_active", null, {
          statusCode: 409,
          retryable: false,
        });
      }

      await ensureJobVector(job, deps, signal);
      await ensureResumeVector(resume, deps, signal);

      return {
        jobId: String(job._id),
        resumeId: String(resume._id),
        jobQdrantId: job.qdrantId,
        resumeQdrantId: resume.qdrantId,
      };
    })().catch((error) => {
      if (error instanceof VectorReadinessError) {
        throw error;
      }

      const code = classifyReadinessError(error);
      throw new VectorReadinessError(error?.message || "Vector readiness failed", code, error, {
        statusCode: code === "vector_dim_mismatch" ? 422 : 503,
        retryable: code !== "vector_dim_mismatch",
      });
    }),
    timeoutMs,
    "vectors_not_ready"
  );
}
