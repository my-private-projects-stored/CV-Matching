import Job from "../models/Job.js";
import Resume from "../models/Resume.js";
import { ensureQdrantId } from "../utils/qdrant-id.js";
import {
  upsertJobVector,
  upsertResumeVector,
} from "../services/vector-index.service.js";
import {
  buildHybridScoreForPair,
  computeSemanticScoreForPair,
  getTopJobsForResumeVector,
  getTopResumesForJobVector,
} from "../services/semantic-search.service.js";
import { HYBRID_SEMANTIC_WEIGHT } from "../constants/scoring.js";

export async function indexJobVectorHandler(req, res, next) {
  try {
    const { vector, payload = {} } = req.body;
    const job = await Job.findById(req.params.jobId);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    if (job.status !== "active") {
      return res.status(409).json({
        message: "Only active jobs can be indexed",
        error_code: "job_not_active",
      });
    }

    ensureQdrantId(job);

    await upsertJobVector({
      qdrantId: job.qdrantId,
      vector,
      payload: {
        ...payload,
        mongoId: String(job._id),
        category: job.category,
        status: job.status,
      },
    });
    job.isAnalyzed = true;
    await job.save();

    return res.status(200).json({ message: "Job vector indexed", qdrantId: job.qdrantId });
  } catch (error) {
    return next(error);
  }
}

export async function indexResumeVectorHandler(req, res, next) {
  try {
    const { vector, payload = {} } = req.body;
    const resume = await Resume.findById(req.params.resumeId);

    if (!resume) {
      return res.status(404).json({ message: "Resume not found" });
    }

    ensureQdrantId(resume);

    await upsertResumeVector({
      qdrantId: resume.qdrantId,
      vector,
      payload: {
        ...payload,
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

    return res.status(200).json({ message: "Resume vector indexed", qdrantId: resume.qdrantId });
  } catch (error) {
    return next(error);
  }
}

export async function searchResumesByJobVectorHandler(req, res, next) {
  try {
    const { vector, limit = 10, scoreThreshold = 0 } = req.body;
    const matches = await getTopResumesForJobVector({
      jobVector: vector,
      limit: Number(limit),
      scoreThreshold: Number(scoreThreshold),
    });

    return res.status(200).json(matches);
  } catch (error) {
    return next(error);
  }
}

export async function searchJobsByResumeVectorHandler(req, res, next) {
  try {
    const { vector, limit = 10, scoreThreshold = 0 } = req.body;
    const matches = await getTopJobsForResumeVector({
      resumeVector: vector,
      limit: Number(limit),
      scoreThreshold: Number(scoreThreshold),
    });

    return res.status(200).json(matches);
  } catch (error) {
    return next(error);
  }
}

export async function hybridScorePairHandler(req, res, next) {
  try {
    const jobId = req.body?.jobId ?? req.body?.job_id;
    const resumeId = req.body?.resumeId ?? req.body?.resume_id;
    const semanticWeight = req.body?.semanticWeight ?? req.body?.semantic_weight ?? HYBRID_SEMANTIC_WEIGHT;
    const hasSemanticScore =
      Object.prototype.hasOwnProperty.call(req.body || {}, "semanticScore") ||
      Object.prototype.hasOwnProperty.call(req.body || {}, "semantic_score");
    const semanticScore = hasSemanticScore
      ? Number(req.body.semanticScore ?? req.body.semantic_score)
      : await computeSemanticScoreForPair({ jobId, resumeId });

    const score = await buildHybridScoreForPair({
      jobId,
      resumeId,
      semanticScore,
      semanticWeight: Number(semanticWeight),
    });

    return res.status(200).json({
      data: {
        semantic_score: score.semanticScore,
        keyword_score: score.keywordScore,
        hybrid_score: score.hybridScore,
        matched_keywords: score.matchedKeywords,
        missing_keywords: score.missingKeywords,
      },
    });
  } catch (error) {
    return next(error);
  }
}
