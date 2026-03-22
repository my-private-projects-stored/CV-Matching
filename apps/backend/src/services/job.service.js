import Job from "../models/Job.js";
import { ensureQdrantId } from "../utils/qdrant-id.js";
import { generateEmbedding } from "./embedding.service.js";
import { deleteJobVector, upsertJobVector } from "./vector-index.service.js";

function shouldRegenerateJobEmbedding(payload = {}) {
  return ["cleanText", "description", "requirements", "title"].some((key) => key in payload);
}

function extractJobEmbeddingText(job) {
  if (job.cleanText && String(job.cleanText).trim()) {
    return String(job.cleanText);
  }

  return [job.title, job.description, job.requirements].filter(Boolean).join("\n");
}

// Tao JD moi va gan qdrantId de dong bo voi vector store.
export async function createJob(payload) {
  const { embeddingVector, ...jobData } = payload;
  const job = new Job(jobData);
  ensureQdrantId(job);
  const saved = await job.save();
  let vector = embeddingVector;

  if (!Array.isArray(vector) || vector.length === 0) {
    vector = await generateEmbedding(extractJobEmbeddingText(saved));
  }

  if (Array.isArray(vector) && vector.length > 0 && saved.status !== "closed") {
    await upsertJobVector({
      qdrantId: saved.qdrantId,
      vector,
      payload: {
        mongoId: String(saved._id),
        category: saved.category,
        status: saved.status,
      },
    });

    saved.isAnalyzed = true;
    await saved.save();
  }

  return saved;
}

// Cap nhat JD va dam bao qdrantId ton tai cho ban ghi cu.
export async function updateJobById(jobId, payload) {
  const { embeddingVector, ...jobData } = payload;
  const job = await Job.findById(jobId);
  if (!job) return null;

  Object.assign(job, jobData);
  ensureQdrantId(job);
  const saved = await job.save();
  const mustRegenerate = shouldRegenerateJobEmbedding(jobData);

  if (saved.status === "closed") {
    await deleteJobVector(saved.qdrantId);
    saved.isAnalyzed = false;
    await saved.save();
    return saved;
  }

  let vector = embeddingVector;
  if ((!Array.isArray(vector) || vector.length === 0) && mustRegenerate) {
    vector = await generateEmbedding(extractJobEmbeddingText(saved));
  }

  if (Array.isArray(vector) && vector.length > 0) {
    await upsertJobVector({
      qdrantId: saved.qdrantId,
      vector,
      payload: {
        mongoId: String(saved._id),
        category: saved.category,
        status: saved.status,
      },
    });

    saved.isAnalyzed = true;
    await saved.save();
  }

  return saved;
}

export async function deleteJobById(jobId) {
  const job = await Job.findById(jobId);
  if (!job) return null;

  await deleteJobVector(job.qdrantId);
  await job.deleteOne();
  return job;
}
