import {
  bulkUpdateApplicationStatus,
  createApplication,
  exportRecentStatusChangesCsvByJob,
  getApplicationFeedback,
  getApplicationStatusHistory,
  getApplicationStatusSummaryByJob,
  listRecentStatusChangesByJob,
  listCandidateApplicationHistory,
  listRankedApplicationsByJob,
  updateApplicationStatus,
} from "../services/application.service.js";
import Application from "../models/Application.js";
import Job from "../models/Job.js";
import Resume from "../models/Resume.js";

function getAuthRole(req) {
  return String(req.auth?.role || "").trim().toLowerCase();
}

function getAuthUserId(req) {
  return String(req.auth?.userId || "").trim();
}

function getAuditActor(req) {
  return String(req.auth?.email || req.auth?.userId || "system").trim() || "system";
}

async function ensureApplicationReadableByActor(applicationId, req) {
  const role = getAuthRole(req);
  const userId = getAuthUserId(req);
  if (!applicationId || !userId) return false;

  if (role === "admin") {
    return true;
  }

  if (role === "recruiter") {
    const application = await Application.findById(applicationId).select("jobId").lean();
    if (!application?.jobId) return false;
    const job = await Job
      .findById(application.jobId)
      .select("recruiterId")
      .lean();
    return String(job?.recruiterId || "") === userId;
  }

  const application = await Application.findById(applicationId).select("resumeId").lean();
  if (!application?.resumeId) return false;

  const resume = await Resume.findById(application.resumeId).select("candidateId").lean();
  if (!resume?.candidateId) return false;

  return String(resume.candidateId) === userId;
}

async function ensureApplicationWritableByRecruiter(applicationId, req) {
  const role = getAuthRole(req);
  if (role === "admin") return true;
  if (role !== "recruiter") return false;
  return ensureApplicationReadableByActor(applicationId, req);
}

function requestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function ensureJobReadableByRecruiter(jobId, req) {
  const role = getAuthRole(req);
  if (role === "admin") return true;
  if (role !== "recruiter") return false;
  const job = await Job.findById(jobId).select("recruiterId").lean();
  return String(job?.recruiterId || "") === getAuthUserId(req);
}

export async function createApplicationHandler(req, res, next) {
  try {
    const role = getAuthRole(req);
    const userId = getAuthUserId(req);

    if (!userId) {
      return res.status(401).json({ message: "Authentication is required" });
    }

    if (role === "candidate") {
      const resumeId = String(req.body?.resume_id || "").trim();
      const resume = await Resume.findById(resumeId).select("candidateId").lean();
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (String(resume.candidateId) !== userId) {
        return res.status(403).json({ message: "You can only apply using your own resume" });
      }
    }

    const result = await createApplication(req.body || {});
    if (result.error) {
      return res.status(result.code || 400).json({ message: result.error });
    }

    return res.status(201).json({
      request_id: requestId(),
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
}

export async function listRankedApplicationsHandler(req, res, next) {
  try {
    const canRead = await ensureJobReadableByRecruiter(req.query?.job_id, req);
    if (!canRead) {
      return res.status(403).json({ message: "You do not have permission to access this job" });
    }

    const result = await listRankedApplicationsByJob(req.query?.job_id, req.query || {});
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

export async function listApplicationHistoryHandler(req, res, next) {
  try {
    const role = getAuthRole(req);
    const userId = getAuthUserId(req);
    const requestedCandidateId = String(req.query?.candidate_id || "").trim();

    const candidateId =
      role === "candidate"
        ? userId
        : requestedCandidateId;

    if (!candidateId) {
      return res.status(400).json({ message: "candidate_id is required" });
    }

    const result = await listCandidateApplicationHistory(candidateId, req.query || {});
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

export async function updateApplicationStatusHandler(req, res, next) {
  try {
    const canWrite = await ensureApplicationWritableByRecruiter(req.params.id, req);
    if (!canWrite) {
      return res.status(403).json({ message: "You do not have permission to update this application" });
    }

    const result = await updateApplicationStatus(req.params.id, req.body?.status, getAuditActor(req));
    if (result.error) {
      return res.status(result.code || 400).json({ message: result.error });
    }

    return res.status(200).json({
      request_id: requestId(),
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
}

export async function bulkUpdateApplicationStatusHandler(req, res, next) {
  try {
    if (getAuthRole(req) === "recruiter") {
      const ids = Array.isArray(req.body?.application_ids) ? req.body.application_ids : [];
      for (const id of ids) {
        const canWrite = await ensureApplicationWritableByRecruiter(id, req);
        if (!canWrite) {
          return res.status(403).json({ message: "You do not have permission to update one or more applications" });
        }
      }
    }

    const result = await bulkUpdateApplicationStatus({
      ...(req.body || {}),
      changed_by: getAuditActor(req),
    });
    if (result.error) {
      return res.status(result.code || 400).json({ message: result.error });
    }

    return res.status(200).json({
      request_id: requestId(),
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getApplicationStatusHistoryHandler(req, res, next) {
  try {
    const canRead = await ensureApplicationReadableByActor(req.params.id, req);
    if (!canRead) {
      return res.status(403).json({ message: "You do not have permission to access this application" });
    }

    const result = await getApplicationStatusHistory(req.params.id);
    if (result.error) {
      return res.status(result.code || 404).json({ message: result.error });
    }

    return res.status(200).json({
      request_id: requestId(),
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getApplicationFeedbackHandler(req, res, next) {
  try {
    const canRead = await ensureApplicationReadableByActor(req.params.id, req);
    if (!canRead) {
      return res.status(403).json({ message: "You do not have permission to access this application" });
    }

    const result = await getApplicationFeedback(req.params.id);
    if (result.error) {
      return res.status(result.code || 404).json({ message: result.error });
    }

    return res.status(200).json({
      request_id: requestId(),
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getApplicationSummaryHandler(req, res, next) {
  try {
    const canRead = await ensureJobReadableByRecruiter(req.query?.job_id, req);
    if (!canRead) {
      return res.status(403).json({ message: "You do not have permission to access this job" });
    }

    const result = await getApplicationStatusSummaryByJob(req.query?.job_id);
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

export async function listRecentStatusChangesHandler(req, res, next) {
  try {
    const canRead = await ensureJobReadableByRecruiter(req.query?.job_id, req);
    if (!canRead) {
      return res.status(403).json({ message: "You do not have permission to access this job" });
    }

    const result = await listRecentStatusChangesByJob(req.query?.job_id, req.query || {});
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

export async function exportRecentStatusChangesCsvHandler(req, res, next) {
  try {
    const canRead = await ensureJobReadableByRecruiter(req.query?.job_id, req);
    if (!canRead) {
      return res.status(403).json({ message: "You do not have permission to access this job" });
    }

    const result = await exportRecentStatusChangesCsvByJob(req.query?.job_id, req.query || {});
    if (result.error) {
      return res.status(result.code || 400).json({ message: result.error });
    }

    const safeJobId = String(result.data?.job?.id || "job").replace(/[^a-zA-Z0-9_-]/g, "_");
    const datePart = new Date().toISOString().slice(0, 10);
    const filename = `status_changes_${safeJobId}_${datePart}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(result.data.csv);
  } catch (error) {
    return next(error);
  }
}
