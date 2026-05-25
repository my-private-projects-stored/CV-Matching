import {
  getJobRecommendationsForResume,
  getResumeRecommendationsForJob,
} from "../services/recommendation.service.js";
import Job from "../models/Job.js";
import Resume from "../models/Resume.js";

function getAuthRole(req) {
  return String(req.auth?.role || "").trim().toLowerCase();
}

function getAuthUserId(req) {
  return String(req.auth?.userId || "").trim();
}

function requestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Feature A: Candidate — GET /api/recommendations/jobs?resume_id=xxx
// ---------------------------------------------------------------------------

export async function getJobRecommendationsHandler(req, res, next) {
  try {
    const role = getAuthRole(req);
    const userId = getAuthUserId(req);

    const rawResumeId = String(req.query?.resume_id || "").trim();
    if (!rawResumeId) {
      return res.status(400).json({ message: "resume_id is required" });
    }

    // Candidates can only query their own resume; admins can query any
    if (role === "candidate") {
      const resume = await Resume.findById(rawResumeId).select("candidateId").lean();
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      if (String(resume.candidateId) !== userId) {
        return res.status(403).json({
          message: "You can only get recommendations for your own resume",
        });
      }
    }

    const options = {
      limit: req.query?.limit,
      scoreThreshold: req.query?.score_threshold,
      semanticWeight: req.query?.semantic_weight,
    };

    const result = await getJobRecommendationsForResume(rawResumeId, options);

    if (result.error) {
      return res.status(result.code || 400).json({ message: result.error });
    }

    return res.status(200).json({
      request_id: requestId(),
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------------
// Feature B: Recruiter — GET /api/recommendations/resumes?job_id=xxx
// ---------------------------------------------------------------------------

export async function getResumeRecommendationsHandler(req, res, next) {
  try {
    const role = getAuthRole(req);
    const userId = getAuthUserId(req);

    const rawJobId = String(req.query?.job_id || "").trim();
    if (!rawJobId) {
      return res.status(400).json({ message: "job_id is required" });
    }

    // Recruiters can only query their own jobs; admins can query any job
    if (role === "recruiter") {
      const job = await Job.findById(rawJobId).select("recruiterId").lean();
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      if (String(job.recruiterId || "") !== userId) {
        return res.status(403).json({
          message: "You do not have permission to access this job",
        });
      }
    }

    const options = {
      limit: req.query?.limit,
      scoreThreshold: req.query?.score_threshold,
      semanticWeight: req.query?.semantic_weight,
    };

    const result = await getResumeRecommendationsForJob(rawJobId, options);

    if (result.error) {
      return res.status(result.code || 400).json({ message: result.error });
    }

    return res.status(200).json({
      request_id: requestId(),
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}
