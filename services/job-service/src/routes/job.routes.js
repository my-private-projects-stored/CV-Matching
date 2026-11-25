import express from "express";
import { ROLES } from "@cvm/shared";
import { requireAuth, requireRole } from "../middleware/auth-context.js";

function toPlainJob(job) {
  if (!job) return job;
  return typeof job.toObject === "function" ? job.toObject() : job;
}

export function createJobRoutes(jobService) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      const result = await jobService.listPublicJobs({
        ...req.query,
        viewer: req.query?.scope === "public" ? null : req.auth,
      });
      const total = Number(result.pagination?.total ?? 0);
      const limit = Number(result.pagination?.limit ?? 20);
      res.json({
        ...result,
        data: result.jobs,
        pagination: {
          ...result.pagination,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/mine", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const jobs = await jobService.listRecruiterJobs({
        recruiterId: req.auth.id,
        status: req.query?.status || null,
      });
      res.json({ jobs, data: jobs });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const job = await jobService.createJob({
        recruiterId: req.auth.id,
        payload: req.body || {},
      });
      const plain = toPlainJob(job);
      res.status(201).json({ ...plain, job, data: plain });
    } catch (error) {
      next(error);
    }
  });

  router.post("/upload", requireAuth, requireRole(ROLES.CANDIDATE, ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const descriptions = Array.isArray(req.body?.job_descriptions) ? req.body.job_descriptions : [];
      if (descriptions.length === 0) {
        return res.status(400).json({ message: "job_descriptions array is required", error_code: "invalid_job_payload" });
      }
      const createdIds = [];
      for (const rawDesc of descriptions.slice(0, 5)) {
        const text = String(rawDesc || "").trim();
        if (!text) continue;
        const firstLine = text.split(/\r?\n/)[0].slice(0, 80).trim() || "Target Position";
        const job = await jobService.createJob({
          recruiterId: req.auth.id,
          payload: {
            title: firstLine,
            description: text,
            status: "draft",
          },
        });
        createdIds.push(String(job._id));
      }
      return res.status(201).json({ message: "Job descriptions uploaded", job_id: createdIds });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const job = await jobService.getJobById({
        jobId: req.params.id,
        viewer: req.auth,
      });
      const plain = toPlainJob(job);
      res.json({ ...plain, job, data: plain });
    } catch (error) {
      next(error);
    }
  });

  async function handleUpdate(req, res, next) {
    try {
      const job = await jobService.updateJob({
        jobId: req.params.id,
        viewer: req.auth,
        payload: req.body || {},
      });
      const plain = toPlainJob(job);
      res.json({ ...plain, job, data: plain });
    } catch (error) {
      next(error);
    }
  }

  router.put("/:id", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), handleUpdate);
  router.patch("/:id", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), handleUpdate);

  router.post("/:id/close", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const job = await jobService.closeJob({
        jobId: req.params.id,
        viewer: req.auth,
      });
      res.json({ job });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const job = await jobService.softDeleteJob({
        jobId: req.params.id,
        viewer: req.auth,
      });
      res.json({ job });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
