import Job from "../models/Job.js";
import Resume from "../models/Resume.js";
import { HYBRID_SEMANTIC_WEIGHT } from "../constants/scoring.js";
import { QDRANT_VECTOR_SIZE } from "../infrastructure/qdrant/client.js";
import {
  computeKeywordAnalysis,
  extractJobKeywords,
  extractResumeKeywords,
  fetchIdfsForKeywords,
  tokenizeAllTokens,
} from "./keyword-analysis.service.js";
import {
  getJobVectorPoint,
  getResumeVectorPoint,
  searchResumeVectorsByJobVector,
  searchJobVectorsByResumeVector,
} from "./vector-index.service.js";

function createScoringError(message, code, statusCode = 503, options = {}) {
  const error = new Error(message);
  error.code = code;
  error.error_code = code;
  error.statusCode = statusCode;
  if (Object.prototype.hasOwnProperty.call(options, "retryable")) {
    error.retryable = options.retryable;
  }
  return error;
}

export function extractPointVector(point) {
  if (Array.isArray(point?.vector)) {
    return point.vector;
  }

  if (point?.vector && typeof point.vector === "object" && Array.isArray(point.vector.default)) {
    return point.vector.default;
  }

  return null;
}

export function cosineSimilarity(vectorA, vectorB) {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB) || vectorA.length !== vectorB.length) {
    throw createScoringError("Vector dimension mismatch", "vector_dim_mismatch", 422, {
      retryable: false,
    });
  }
  if (vectorA.length !== QDRANT_VECTOR_SIZE || vectorB.length !== QDRANT_VECTOR_SIZE) {
    throw createScoringError("Vector dimension mismatch", "vector_dim_mismatch", 422, {
      retryable: false,
    });
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i += 1) {
    const a = Number(vectorA[i] || 0);
    const b = Number(vectorB[i] || 0);
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function boundScore(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export async function getTopResumesForJobVector({ jobVector, limit = 10, scoreThreshold = 0 }) {
  return searchResumeVectorsByJobVector({
    vector: jobVector,
    limit,
    scoreThreshold,
  });
}

export async function getTopJobsForResumeVector({ resumeVector, limit = 10, scoreThreshold = 0 }) {
  return searchJobVectorsByResumeVector({
    vector: resumeVector,
    limit,
    scoreThreshold,
  });
}

export async function computeSemanticScoreForPair({ jobId, resumeId }) {
  const [job, resume] = await Promise.all([
    Job.findById(jobId).lean(),
    Resume.findById(resumeId).lean(),
  ]);

  if (!job || !resume) {
    throw createScoringError("Job or Resume not found for semantic scoring", "resource_not_found", 404);
  }

  if (!job.qdrantId || !resume.qdrantId) {
    throw createScoringError("Qdrant point id is missing", "qdrant_point_missing");
  }

  let jobPoint;
  let resumePoint;
  try {
    [jobPoint, resumePoint] = await Promise.all([
      getJobVectorPoint(job.qdrantId, { withVector: true }),
      getResumeVectorPoint(resume.qdrantId, { withVector: true }),
    ]);
  } catch (error) {
    throw createScoringError(
      error?.message || "Qdrant is unavailable",
      "qdrant_unavailable"
    );
  }

  if (!jobPoint || !resumePoint) {
    throw createScoringError("Qdrant point is missing", "qdrant_point_missing");
  }

  const jobVector = extractPointVector(jobPoint);
  const resumeVector = extractPointVector(resumePoint);
  const rawScore = cosineSimilarity(jobVector, resumeVector);

  return boundScore(rawScore);
}

export function computeHybridScore(semanticScore, keywordScore, semanticWeight = HYBRID_SEMANTIC_WEIGHT) {
  const parsedWeight = Number(semanticWeight);
  const safeWeight = Number.isFinite(parsedWeight)
    ? boundScore(parsedWeight)
    : HYBRID_SEMANTIC_WEIGHT;
  return safeWeight * boundScore(semanticScore) + (1 - safeWeight) * boundScore(keywordScore);
}

export async function buildHybridScoreForPair({
  jobId,
  resumeId,
  semanticScore,
  semanticWeight = HYBRID_SEMANTIC_WEIGHT,
}) {
  const [job, resume] = await Promise.all([
    Job.findById(jobId).lean(),
    Resume.findById(resumeId).lean(),
  ]);

  if (!job || !resume) {
    throw new Error("Job or Resume not found for hybrid scoring");
  }

  const jobKeywords = extractJobKeywords(job);
  const resumeKeywords = extractResumeKeywords(resume);

  // Fetch BM25 IDFs for jobKeywords from Resume collection (corpus we are scoring against)
  const { idfMap } = await fetchIdfsForKeywords(jobKeywords, "resume");
  const docTokens = tokenizeAllTokens(resume.rawText || "");

  const keywordAnalysis = computeKeywordAnalysis(jobKeywords, resumeKeywords, {
    docTokens,
    idfMap,
  });

  const boundedSemantic = boundScore(semanticScore);
  const boundedKeyword = boundScore(keywordAnalysis.keywordScore);
  const hybridScore = computeHybridScore(boundedSemantic, boundedKeyword, semanticWeight);

  return {
    semanticScore: boundedSemantic,
    keywordScore: boundedKeyword,
    hybridScore,
    matchedKeywords: keywordAnalysis.matchedKeywords,
    missingKeywords: keywordAnalysis.missingKeywords,
  };
}
