import crypto from "node:crypto";
import Redis from "ioredis";
import mongoose from "mongoose";
import { SERVICE_DATABASES, buildServiceMongoUri, createRedisBus } from "@cvm/shared";
import { createApp } from "./app.js";

const PORT = Number.parseInt(process.env.PORT || "5004", 10);
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://admin:admin123@localhost:27017/?authSource=admin&replicaSet=rs0";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const DB_NAME = process.env.SERVICE_DB_NAME || SERVICE_DATABASES.application;

function toQdrantPointId(id) {
  const hex = crypto.createHash("sha256").update(String(id)).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function tokenize(textOrArray) {
  const raw = Array.isArray(textOrArray) ? textOrArray.join(" ") : String(textOrArray || "");
  return Array.from(
    new Set(
      raw
        .toLowerCase()
        .split(/[^a-z0-9.+#-]+/i)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2)
    )
  );
}

function computeKeywordOverlap(resumeText, jobTokensInput) {
  const targetTokens = tokenize(jobTokensInput);
  if (targetTokens.length === 0) {
    return { keywordScore: 0, matchedKeywords: [], missingKeywords: [] };
  }
  const sourceSet = new Set(tokenize(resumeText));
  const matchedKeywords = [];
  const missingKeywords = [];
  for (const t of targetTokens) {
    if (sourceSet.has(t)) matchedKeywords.push(t);
    else missingKeywords.push(t);
  }
  return {
    keywordScore: Number((matchedKeywords.length / targetTokens.length).toFixed(4)),
    matchedKeywords: matchedKeywords.slice(0, 20),
    missingKeywords: missingKeywords.slice(0, 20),
  };
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) return null;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return Math.max(0, Math.min(1, Number((dot / (Math.sqrt(na) * Math.sqrt(nb))).toFixed(4))));
}

function createLiveScoringStep({
  resumeServiceUrl = process.env.RESUME_SERVICE_URL || "http://resume-service:5002",
  jobServiceUrl = process.env.JOB_SERVICE_URL || "http://job-service:5003",
  qdrantUrl = process.env.QDRANT_URL || "http://qdrant:6333",
  internalToken = process.env.WORKER_INTERNAL_TOKEN || "dev-worker-token",
} = {}) {
  async function fetchJson(url) {
    const resp = await fetch(url, { headers: { "x-internal-token": internalToken } });
    if (!resp.ok) return null;
    return resp.json().catch(() => null);
  }

  async function fetchQdrantVector(collection, mongoId) {
    try {
      const resp = await fetch(`${qdrantUrl}/collections/${collection}/points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [toQdrantPointId(mongoId)], with_vector: true }),
      });
      if (!resp.ok) return null;
      const body = await resp.json().catch(() => null);
      return body?.result?.[0]?.vector || null;
    } catch {
      return null;
    }
  }

  return async function liveScoringStep(app) {
    const [resumeData, jobData, resumeVec, jobVec] = await Promise.all([
      fetchJson(`${resumeServiceUrl}/internal/resumes/${encodeURIComponent(app.resumeId)}`),
      fetchJson(`${jobServiceUrl}/internal/jobs/${encodeURIComponent(app.jobId)}`),
      fetchQdrantVector("resumes_vectors", app.resumeId),
      fetchQdrantVector("jobs_vectors", app.jobId),
    ]);

    const resume = resumeData?.resume || {};
    const job = jobData?.job || {};
    const resumeText = [resume.rawText || "", ...(resume.parsedData?.skills || [])].join(" ");
    const jobTokens = [job.title || "", ...(job.skills || []), job.description || ""];
    const kw = computeKeywordOverlap(resumeText, jobTokens);
    const cos = cosineSimilarity(resumeVec, jobVec);

    return {
      semanticScore: cos !== null ? cos : kw.keywordScore,
      keywordScore: kw.keywordScore,
      matchedKeywords: kw.matchedKeywords,
      missingKeywords: kw.missingKeywords,
    };
  };
}

function createJobMetadataResolver({
  jobServiceUrl = process.env.JOB_SERVICE_URL || "http://job-service:5003",
  internalToken = process.env.WORKER_INTERNAL_TOKEN || "dev-worker-token",
} = {}) {
  return async function resolveJobMetadata(jobId) {
    const resp = await fetch(`${jobServiceUrl}/internal/jobs/${encodeURIComponent(jobId)}`, {
      headers: { "x-internal-token": internalToken },
    });
    if (!resp.ok) return null;
    const body = await resp.json().catch(() => null);
    return body?.job || null;
  };
}

function createCandidateMetadataResolver({
  authServiceUrl = process.env.AUTH_SERVICE_URL || "http://auth-service:5001",
  internalToken = process.env.WORKER_INTERNAL_TOKEN || "dev-worker-token",
} = {}) {
  return async function resolveCandidateMetadata(candidateId) {
    const resp = await fetch(`${authServiceUrl}/internal/users/${encodeURIComponent(candidateId)}`, {
      headers: { "x-internal-token": internalToken },
    });
    if (!resp.ok) return null;
    const body = await resp.json().catch(() => null);
    const user = body?.user;
    if (!user) return null;
    return {
      fullName: user.full_name || user.fullName || "",
      email: user.email || "",
    };
  };
}

function createResumeMetadataResolver({
  resumeServiceUrl = process.env.RESUME_SERVICE_URL || "http://resume-service:5002",
  internalToken = process.env.WORKER_INTERNAL_TOKEN || "dev-worker-token",
} = {}) {
  return async function resolveResumeMetadata(resumeId) {
    const resp = await fetch(`${resumeServiceUrl}/internal/resumes/${encodeURIComponent(resumeId)}`, {
      headers: { "x-internal-token": internalToken },
    });
    if (!resp.ok) return null;
    const body = await resp.json().catch(() => null);
    const resume = body?.resume;
    if (!resume) return null;
    return {
      title: resume.title || "",
    };
  };
}

async function start() {
  const serviceMongoUri = buildServiceMongoUri(MONGO_URI, DB_NAME);
  await mongoose.connect(serviceMongoUri);

  const redisClient = new Redis(REDIS_URL);
  const subscriberClient = new Redis(REDIS_URL);
  const redisBus = createRedisBus(redisClient);

  redisClient.on("error", (err) => {
    console.error("[application-service] Redis error:", err.message);
  });
  subscriberClient.on("error", (err) => {
    console.error("[application-service] Redis subscriber error:", err.message);
  });

  const app = createApp({
    redisClient,
    subscriberClient,
    redisBus,
    scoringStep: createLiveScoringStep(),
    resolveJobMetadata: createJobMetadataResolver(),
    resolveCandidateMetadata: createCandidateMetadataResolver(),
    resolveResumeMetadata: createResumeMetadataResolver(),
  });

  app.locals.outboxPublisher.start();

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[application-service] Listening on port ${PORT} (DB: ${DB_NAME})`);
  });

  function shutdown() {
    app.locals.outboxPublisher.stop();
    server.close(async () => {
      redisClient.disconnect();
      subscriberClient.disconnect();
      await mongoose.disconnect();
      process.exit(0);
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error("[application-service] Failed to start:", err);
  process.exit(1);
});
