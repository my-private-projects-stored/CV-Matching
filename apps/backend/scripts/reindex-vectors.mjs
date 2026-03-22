import "dotenv/config";

import mongoose from "mongoose";

import Job from "../src/models/Job.js";
import Resume from "../src/models/Resume.js";
import { bootstrapQdrant } from "../src/bootstrap/qdrant-bootstrap.js";
import { generateEmbedding } from "../src/services/embedding.service.js";
import { ensureQdrantId } from "../src/utils/qdrant-id.js";
import { upsertJobVector, upsertResumeVector } from "../src/services/vector-index.service.js";

function getArgValue(flag, defaultValue = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return defaultValue;
  return process.argv[idx + 1];
}

function toChunks(items, size = 50) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function extractJobText(job) {
  if (job.cleanText && String(job.cleanText).trim()) return String(job.cleanText);
  return [job.title, job.description, job.requirements].filter(Boolean).join("\n");
}

function extractResumeText(resume) {
  if (resume.rawText && String(resume.rawText).trim()) return String(resume.rawText);
  return JSON.stringify(resume.parsedData || {});
}

async function reindexJobs(modelVersion) {
  const jobs = await Job.find({ status: { $ne: "closed" } });
  let total = 0;

  for (const batch of toChunks(jobs, 25)) {
    for (const job of batch) {
      ensureQdrantId(job);
      const text = extractJobText(job);
      const vector = await generateEmbedding(text);

      await upsertJobVector({
        qdrantId: job.qdrantId,
        vector,
        payload: {
          mongoId: String(job._id),
          category: job.category,
          status: job.status,
          embeddingModelVersion: modelVersion,
          reindexedAt: new Date().toISOString(),
        },
      });

      job.isAnalyzed = true;
      await job.save();
      total += 1;
    }
  }

  return total;
}

async function reindexResumes(modelVersion) {
  const resumes = await Resume.find({});
  let total = 0;

  for (const batch of toChunks(resumes, 25)) {
    for (const resume of batch) {
      ensureQdrantId(resume);
      const text = extractResumeText(resume);
      const vector = await generateEmbedding(text);

      await upsertResumeVector({
        qdrantId: resume.qdrantId,
        vector,
        payload: {
          mongoId: String(resume._id),
          candidateId: String(resume.candidateId),
          isAnalyzed: resume.isAnalyzed,
          embeddingModelVersion: modelVersion,
          reindexedAt: new Date().toISOString(),
        },
      });

      resume.isAnalyzed = true;
      await resume.save();
      total += 1;
    }
  }

  return total;
}

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is required");
  }

  const target = getArgValue("--target", "all");
  const modelVersion = getArgValue("--model-version", "sbert-all-MiniLM-L6-v2");

  await mongoose.connect(mongoUri);
  await bootstrapQdrant();

  let jobsCount = 0;
  let resumesCount = 0;

  if (target === "all" || target === "jobs") {
    jobsCount = await reindexJobs(modelVersion);
  }

  if (target === "all" || target === "resumes") {
    resumesCount = await reindexResumes(modelVersion);
  }

  console.log(`Re-index completed. jobs=${jobsCount}, resumes=${resumesCount}, model=${modelVersion}`);
}

main()
  .then(async () => {
    await mongoose.disconnect();
  })
  .catch(async (error) => {
    console.error("Re-index failed:", error.message);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
