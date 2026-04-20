import {
  createJob,
  deleteJobById,
  getJobById,
  listJobs,
  updateJobById,
} from "../services/job.service.js";
import { getResumeByPublicId } from "../services/resume.service.js";
import Job from "../models/Job.js";

const DEFAULT_RECRUITER_ID = "000000000000000000000002";

function getAuthRole(req) {
  return String(req.auth?.role || "").trim().toLowerCase();
}

function getAuthUserId(req) {
  return String(req.auth?.userId || "").trim();
}

function inferJobTitle(description) {
  const firstLine = String(description || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return "Imported Job Description";
  }

  return firstLine.slice(0, 120);
}

export async function listJobsHandler(req, res, next) {
  try {
    const result = await listJobs(req.query || {});
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function getJobHandler(req, res, next) {
  try {
    const job = await getJobById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    return res.status(200).json(job);
  } catch (error) {
    return next(error);
  }
}

export async function createJobHandler(req, res, next) {
  try {
    const created = await createJob(req.body);
    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
}

export async function uploadJobDescriptionsHandler(req, res, next) {
  try {
    const descriptions = Array.isArray(req.body?.job_descriptions) ? req.body.job_descriptions : [];
    const resumeId = String(req.body?.resume_id || "").trim();
    const authRole = getAuthRole(req);

    if (!descriptions.length) {
      return res.status(400).json({ message: "No job descriptions provided" });
    }

    if (authRole === "candidate") {
      if (!resumeId) {
        return res.status(400).json({ message: "resume_id is required for candidate uploads" });
      }

      const resume = await getResumeByPublicId(resumeId);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (String(resume.candidateId || "") !== getAuthUserId(req)) {
        return res.status(403).json({ message: "You can only upload job descriptions for your own resume" });
      }
    }

    const jobIds = [];

    for (const description of descriptions) {
      const content = String(description || "").trim();
      if (!content) {
        return res.status(400).json({ message: "Empty job description" });
      }

      const created = await Job.create({
        recruiterId: DEFAULT_RECRUITER_ID,
        title: inferJobTitle(content),
        description: content,
        requirements: content,
        cleanText: content,
        category: "IT",
        location: "Remote",
        experienceLevel: "Any",
        status: "active",
      });

      jobIds.push(String(created._id));
    }

    return res.status(200).json({
      message: "data successfully processed",
      job_id: jobIds,
      request: {
        job_descriptions: descriptions,
        resume_id: resumeId || null,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateJobHandler(req, res, next) {
  try {
    const updated = await updateJobById(req.params.id, req.body);

    if (!updated) {
      return res.status(404).json({ message: "Job not found" });
    }

    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
}

export async function deleteJobHandler(req, res, next) {
  try {
    const deleted = await deleteJobById(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Job not found" });
    }

    return res.status(200).json({ message: "Job deleted", id: String(deleted._id) });
  } catch (error) {
    return next(error);
  }
}
