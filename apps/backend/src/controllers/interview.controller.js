import { generateInterviewQuestions } from "../services/interview.service.js";
import { assertAiGenerationAllowed } from "../services/config.service.js";
import Application from "../models/Application.js";
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

async function recruiterCanAccessResume(userId, resumeId, jobId) {
  if (!userId || !resumeId) return false;

  if (jobId) {
    const job = await Job.findById(jobId).select("recruiterId").lean();
    if (!job) {
      const error = new Error("Job not found");
      error.statusCode = 404;
      throw error;
    }

    if (String(job.recruiterId || "") !== userId) {
      return false;
    }

    const linkedApplication = await Application.exists({ resumeId, jobId });
    return Boolean(linkedApplication);
  }

  const applications = await Application.find({ resumeId }).select("jobId").lean();
  if (!applications.length) return false;

  const jobIds = applications.map((item) => item.jobId).filter(Boolean);
  const ownedJobs = await Job.countDocuments({
    _id: { $in: jobIds },
    recruiterId: userId,
  });
  return ownedJobs > 0;
}

// ---------------------------------------------------------------------------
// Feature C: Recruiter — POST /api/interviews/questions
// Body: { resume_id, job_id?, language? }
// ---------------------------------------------------------------------------

export async function generateInterviewQuestionsHandler(req, res, next) {
  try {
    await assertAiGenerationAllowed("interview_questions");

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

    if (role === "recruiter") {
      const allowed = await recruiterCanAccessResume(userId, rawResumeId, rawJobId || null);
      if (!allowed) {
        return res.status(403).json({
          message: rawJobId
            ? "You can only generate interview questions for applications to your jobs"
            : "You can only generate interview questions for resumes submitted to your jobs",
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
