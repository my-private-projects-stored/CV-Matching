import Job from "../models/Job.js";
import Resume from "../models/Resume.js";
import {
  upsertJobVector,
  upsertResumeVector,
} from "../services/vector-index.service.js";
import {
  buildHybridScoreForPair,
  getTopJobsForResumeVector,
  getTopResumesForJobVector,
} from "../services/semantic-search.service.js";

export async function indexJobVectorHandler(req, res, next) {
  try {
    const { vector, payload = {} } = req.body;
    const job = await Job.findById(req.params.jobId);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (!job.qdrantId) {
      return res.status(400).json({ message: "Job does not have qdrantId" });
    }

    await upsertJobVector({
      qdrantId: job.qdrantId,
      vector,
      payload: {
        mongoId: String(job._id),
        category: job.category,
        status: job.status,
        ...payload,
      },
    });

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

    if (!resume.qdrantId) {
      return res.status(400).json({ message: "Resume does not have qdrantId" });
    }

    await upsertResumeVector({
      qdrantId: resume.qdrantId,
      vector,
      payload: {
        mongoId: String(resume._id),
        candidateId: String(resume.candidateId),
        ...payload,
      },
    });

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
    const { jobId, resumeId, semanticScore = 0, semanticWeight = 0.7 } = req.body;

    const score = await buildHybridScoreForPair({
      jobId,
      resumeId,
      semanticScore: Number(semanticScore),
      semanticWeight: Number(semanticWeight),
    });

    return res.status(200).json(score);
  } catch (error) {
    return next(error);
  }
}
