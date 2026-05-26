import Job from "../models/Job.js";
import Resume from "../models/Resume.js";
import User from "../models/User.js";
import { HYBRID_SEMANTIC_WEIGHT } from "../constants/scoring.js";
import { generateEmbedding } from "./embedding.service.js";
import {
  computeKeywordAnalysis,
  extractJobKeywords,
  extractResumeKeywords,
} from "./keyword-analysis.service.js";
import {
  searchJobVectorsByResumeVector,
  searchResumeVectorsByJobVector,
} from "./vector-index.service.js";

function computeHybridScore(semanticScore, keywordScore, semanticWeight = HYBRID_SEMANTIC_WEIGHT) {
  const bounded = (v) => Math.max(0, Math.min(1, Number(v) || 0));
  const parsedWeight = Number(semanticWeight);
  const sw = Number.isFinite(parsedWeight)
    ? Math.max(0, Math.min(1, parsedWeight))
    : HYBRID_SEMANTIC_WEIGHT;
  return sw * bounded(semanticScore) + (1 - sw) * bounded(keywordScore);
}

function extractResumeEmbeddingText(resumeDoc) {
  if (resumeDoc?.rawText && String(resumeDoc.rawText).trim()) {
    return String(resumeDoc.rawText).trim();
  }
  const parsedData = resumeDoc?.parsedData || {};
  const parts = [
    parsedData.personalInfo?.fullName,
    parsedData.personalInfo?.title,
    Array.isArray(parsedData.skills) ? parsedData.skills.join(", ") : "",
    Array.isArray(parsedData.additional?.technicalSkills)
      ? parsedData.additional.technicalSkills.join(", ")
      : "",
    Array.isArray(parsedData.workExperience)
      ? parsedData.workExperience.map((e) => `${e.title || ""} at ${e.company || ""}`).join(". ")
      : "",
  ];
  return parts.filter(Boolean).join("\n");
}

function extractJobEmbeddingText(jobDoc) {
  if (jobDoc?.cleanText && String(jobDoc.cleanText).trim()) {
    return String(jobDoc.cleanText).trim();
  }
  return [jobDoc?.title, jobDoc?.description, jobDoc?.requirements, jobDoc?.benefits]
    .filter(Boolean)
    .join("\n");
}

function normalizeLimit(value, defaultVal = 10, max = 50) {
  const parsed = Number.parseInt(String(value || String(defaultVal)), 10);
  return Number.isInteger(parsed) ? Math.max(1, Math.min(max, parsed)) : defaultVal;
}

// ---------------------------------------------------------------------------
// Feature A: Candidate — Find matching Jobs for a given Resume
// ---------------------------------------------------------------------------

/**
 * Given a resumeId, embed the CV text, search Qdrant for matching jobs,
 * enrich with MongoDB data, and return a ranked list with scores.
 *
 * @param {string} resumeId - MongoDB ID or public ID of the resume
 * @param {object} options  - { limit, scoreThreshold, semanticWeight }
 */
export async function getJobRecommendationsForResume(resumeId, options = {}) {
  const resume = await Resume.findById(resumeId).lean();
  if (!resume) {
    return { error: "Resume not found", code: 404 };
  }

  const limit = normalizeLimit(options.limit, 10);
  const scoreThreshold = Math.max(0, Math.min(1, Number(options.scoreThreshold || 0)));
  const semanticWeight = Math.max(0, Math.min(1, Number(options.semanticWeight ?? HYBRID_SEMANTIC_WEIGHT)));

  // 1. Generate embedding from CV text
  let resumeVector;
  try {
    const embeddingText = extractResumeEmbeddingText(resume);
    if (!embeddingText) {
      return { error: "Resume has no text content to embed", code: 400 };
    }
    resumeVector = await generateEmbedding(embeddingText);
  } catch (err) {
    return { error: `Embedding failed: ${err.message}`, code: 502 };
  }

  // 2. Search Qdrant for top matching job vectors
  let qdrantHits;
  try {
    qdrantHits = await searchJobVectorsByResumeVector({
      vector: resumeVector,
      limit: limit * 3, // over-fetch to filter/rank
      scoreThreshold,
    });
  } catch (err) {
    return { error: `Vector search failed: ${err.message}`, code: 502 };
  }

  if (!Array.isArray(qdrantHits) || qdrantHits.length === 0) {
    return {
      data: [],
      meta: { resume_id: String(resume._id), total: 0, semantic_weight: semanticWeight },
    };
  }

  // 3. Map qdrantIds → mongoIds
  const mongoIdByQdrant = new Map();
  for (const hit of qdrantHits) {
    const mongoId = String(hit.payload?.mongoId || "").trim();
    if (mongoId) {
      mongoIdByQdrant.set(String(hit.id), { semanticScore: hit.score, mongoId });
    }
  }

  const mongoIds = [...mongoIdByQdrant.values()].map((v) => v.mongoId);
  const jobs = await Job.find({
    _id: { $in: mongoIds },
    status: "active",
  }).lean();

  const jobById = new Map(jobs.map((j) => [String(j._id), j]));
  const resumeKeywords = extractResumeKeywords(resume);

  // 4. Compute hybrid scores and build result
  const results = [];
  for (const hit of qdrantHits) {
    const meta = mongoIdByQdrant.get(String(hit.id));
    if (!meta) continue;
    const job = jobById.get(meta.mongoId);
    if (!job) continue;

    const jobKeywords = extractJobKeywords(job);
    const keywordAnalysis = computeKeywordAnalysis(jobKeywords, resumeKeywords);
    const keywordScore = keywordAnalysis.keywordScore;
    const hybridScore = computeHybridScore(meta.semanticScore, keywordScore, semanticWeight);

    results.push({
      job_id: String(job._id),
      title: job.title || "",
      category: job.category || "",
      location: job.location || "",
      experience_level: job.experienceLevel || "",
      status: job.status || "",
      description_preview: String(job.description || "").slice(0, 200),
      scores: {
        semantic_score: Math.round(meta.semanticScore * 1000) / 1000,
        keyword_score: Math.round(keywordScore * 1000) / 1000,
        hybrid_score: Math.round(hybridScore * 1000) / 1000,
      },
      matched_keywords: keywordAnalysis.matchedKeywords.slice(0, 10),
      application_deadline: job.applicationDeadline || null,
      created_at: job.createdAt ? new Date(job.createdAt).toISOString() : null,
    });
  }

  // Sort by hybrid score descending
  results.sort((a, b) => b.scores.hybrid_score - a.scores.hybrid_score);
  const paginated = results.slice(0, limit);

  return {
    data: paginated,
    meta: {
      resume_id: String(resume._id),
      total: results.length,
      semantic_weight: semanticWeight,
    },
  };
}

// ---------------------------------------------------------------------------
// Feature B: Recruiter — Find matching Resumes for a given Job
// ---------------------------------------------------------------------------

/**
 * Given a jobId, embed the JD text, search Qdrant for matching resumes,
 * enrich with MongoDB data (Resume + candidate info), and return a ranked list.
 *
 * @param {string} jobId   - MongoDB ID of the job
 * @param {object} options - { limit, scoreThreshold, semanticWeight }
 */
export async function getResumeRecommendationsForJob(jobId, options = {}) {
  const job = await Job.findById(jobId).lean();
  if (!job) {
    return { error: "Job not found", code: 404 };
  }

  const limit = normalizeLimit(options.limit, 10);
  const scoreThreshold = Math.max(0, Math.min(1, Number(options.scoreThreshold || 0)));
  const semanticWeight = Math.max(0, Math.min(1, Number(options.semanticWeight ?? HYBRID_SEMANTIC_WEIGHT)));

  // 1. Generate embedding from JD text
  let jobVector;
  try {
    const embeddingText = extractJobEmbeddingText(job);
    if (!embeddingText) {
      return { error: "Job has no text content to embed", code: 400 };
    }
    jobVector = await generateEmbedding(embeddingText);
  } catch (err) {
    return { error: `Embedding failed: ${err.message}`, code: 502 };
  }

  // 2. Search Qdrant for top matching resume vectors
  let qdrantHits;
  try {
    qdrantHits = await searchResumeVectorsByJobVector({
      vector: jobVector,
      limit: limit * 3,
      scoreThreshold,
    });
  } catch (err) {
    return { error: `Vector search failed: ${err.message}`, code: 502 };
  }

  if (!Array.isArray(qdrantHits) || qdrantHits.length === 0) {
    return {
      data: [],
      meta: {
        job_id: String(job._id),
        job_title: job.title || "",
        total: 0,
        semantic_weight: semanticWeight,
      },
    };
  }

  // 3. Map qdrantIds → mongoIds
  const mongoIdByQdrant = new Map();
  for (const hit of qdrantHits) {
    const mongoId = String(hit.payload?.mongoId || "").trim();
    if (mongoId) {
      mongoIdByQdrant.set(String(hit.id), { semanticScore: hit.score, mongoId });
    }
  }

  const mongoIds = [...mongoIdByQdrant.values()].map((v) => v.mongoId);
  const resumes = await Resume.find({ _id: { $in: mongoIds } }).lean();
  const resumeById = new Map(resumes.map((r) => [String(r._id), r]));

  // Fetch candidate user info for resumes that have candidateId
  const candidateIds = [...new Set(
    resumes.map((r) => String(r.candidateId || "")).filter(Boolean)
  )];
  let userById = new Map();
  if (candidateIds.length > 0) {
    try {
      const users = await User.find({ _id: { $in: candidateIds } })
        .select("_id fullName email")
        .lean();
      userById = new Map(users.map((u) => [String(u._id), u]));
    } catch (_) {
      // user lookup is best-effort
    }
  }

  const jobKeywords = extractJobKeywords(job);

  // 4. Compute hybrid scores and build result
  const results = [];
  for (const hit of qdrantHits) {
    const meta = mongoIdByQdrant.get(String(hit.id));
    if (!meta) continue;
    const resume = resumeById.get(meta.mongoId);
    if (!resume) continue;

    const resumeKeywords = extractResumeKeywords(resume);
    const keywordAnalysis = computeKeywordAnalysis(jobKeywords, resumeKeywords);
    const keywordScore = keywordAnalysis.keywordScore;
    const hybridScore = computeHybridScore(meta.semanticScore, keywordScore, semanticWeight);

    const candidateId = String(resume.candidateId || "");
    const user = userById.get(candidateId) || null;
    const parsedData = resume.parsedData || {};
    const topSkills = [
      ...(Array.isArray(parsedData.skills) ? parsedData.skills : []),
      ...(Array.isArray(parsedData.additional?.technicalSkills)
        ? parsedData.additional.technicalSkills
        : []),
    ];

    results.push({
      resume_id: String(resume._id),
      candidate_id: candidateId || null,
      candidate_name: user?.fullName || parsedData?.personalInfo?.fullName || null,
      candidate_email: user?.email || parsedData?.personalInfo?.email || null,
      resume_title: resume.title || resume.filename || null,
      is_master: Boolean(resume.isMaster),
      processing_status: resume.isAnalyzed ? "analyzed" : "pending",
      current_role: parsedData?.personalInfo?.title || null,
      top_skills: [...new Set(topSkills)].slice(0, 8),
      scores: {
        semantic_score: Math.round(meta.semanticScore * 1000) / 1000,
        keyword_score: Math.round(keywordScore * 1000) / 1000,
        hybrid_score: Math.round(hybridScore * 1000) / 1000,
      },
      matched_keywords: keywordAnalysis.matchedKeywords.slice(0, 10),
      created_at: resume.createdAt ? new Date(resume.createdAt).toISOString() : null,
      updated_at: resume.updatedAt ? new Date(resume.updatedAt).toISOString() : null,
    });
  }

  // Sort by hybrid score descending
  results.sort((a, b) => b.scores.hybrid_score - a.scores.hybrid_score);
  const paginated = results.slice(0, limit);

  return {
    data: paginated,
    meta: {
      job_id: String(job._id),
      job_title: job.title || "",
      total: results.length,
      semantic_weight: semanticWeight,
    },
  };
}
