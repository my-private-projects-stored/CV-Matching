import Job from "../models/Job.js";
import Resume from "../models/Resume.js";
import {
  searchResumeVectorsByJobVector,
  searchJobVectorsByResumeVector,
} from "./vector-index.service.js";

function normalizeKeyword(value) {
  return String(value || "").trim().toLowerCase();
}

function extractResumeKeywords(resumeDoc) {
  const parsedSkills = Array.isArray(resumeDoc?.parsedData?.skills)
    ? resumeDoc.parsedData.skills
    : [];

  return parsedSkills.map(normalizeKeyword).filter(Boolean);
}

function computeKeywordAnalysis(jobKeywords = [], resumeKeywords = []) {
  const jobSet = new Set(jobKeywords.map(normalizeKeyword).filter(Boolean));
  const resumeSet = new Set(resumeKeywords.map(normalizeKeyword).filter(Boolean));

  const matchedKeywords = [...jobSet].filter((k) => resumeSet.has(k));
  const missingKeywords = [...jobSet].filter((k) => !resumeSet.has(k));
  const keywordScore = jobSet.size === 0 ? 0 : matchedKeywords.length / jobSet.size;

  return { matchedKeywords, missingKeywords, keywordScore };
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

export async function buildHybridScoreForPair({ jobId, resumeId, semanticScore = 0, semanticWeight = 0.7 }) {
  const [job, resume] = await Promise.all([
    Job.findById(jobId).lean(),
    Resume.findById(resumeId).lean(),
  ]);

  if (!job || !resume) {
    throw new Error("Job or Resume not found for hybrid scoring");
  }

  const keywordAnalysis = computeKeywordAnalysis(job.keywords || [], extractResumeKeywords(resume));

  const boundedSemantic = Math.max(0, Math.min(1, Number(semanticScore || 0)));
  const boundedKeyword = Math.max(0, Math.min(1, Number(keywordAnalysis.keywordScore || 0)));
  const safeWeight = Math.max(0, Math.min(1, Number(semanticWeight || 0.7)));
  const hybridScore = safeWeight * boundedSemantic + (1 - safeWeight) * boundedKeyword;

  return {
    semanticScore: boundedSemantic,
    keywordScore: boundedKeyword,
    hybridScore,
    matchedKeywords: keywordAnalysis.matchedKeywords,
    missingKeywords: keywordAnalysis.missingKeywords,
  };
}
