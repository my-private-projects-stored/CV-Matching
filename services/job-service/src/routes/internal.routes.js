import express from "express";
import { requireInternalToken } from "../middleware/auth-context.js";

export function createInternalRoutes(jobService, internalToken) {
  const router = express.Router();
  router.use(requireInternalToken(internalToken));

  router.get("/jobs/:id", async (req, res, next) => {
    try {
      const job = await jobService.getJobInternal({ jobId: req.params.id });
      res.json({ job });
    } catch (error) {
      next(error);
    }
  });

  router.get("/jobs/by-recruiter/:recruiterId", async (req, res, next) => {
    try {
      const jobs = await jobService.listRecruiterJobs({ recruiterId: req.params.recruiterId });
      res.json({ jobs });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
