import { generateInterviewQuestions } from "../services/interview.service.js";
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
// Feature C: Recruiter — POST /api/interviews/questions
// Body: { resume_id, job_id?, language? }
// ---------------------------------------------------------------------------

export async function generateInterviewQuestionsHandler(req, res, next) {
  try {
    const role = getAuthRole(req);
    const userId = getAuthUserId(req);

    const rawResumeId = String(req.body?.resume_id || "").trim();
    const rawJobId = String(req.body?.job_id || "").trim();
    const language = String(req.body?.language || "en").trim();

    if (!rawResumeId) {
      return res.status(400).json({ message: "resume_id is required" });
    }

    // Verify resume exists
    const resume = await Resume.findById(rawResumeId).select("_id candidateId").lean();
    if (!resume) {
      return res.status(404).json({ message: "Resume not found" });
    }

    // If job_id is provided, verify recruiter owns the job
    if (rawJobId && role === "recruiter") {
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

    const result = await generateInterviewQuestions(
      rawResumeId,
      rawJobId || null,
      { language }
    );

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
