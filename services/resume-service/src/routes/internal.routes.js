import express from "express";
import { requireInternalToken } from "../middleware/auth-context.js";

export function createInternalRoutes(resumeService, internalToken) {
  const router = express.Router();
  router.use(requireInternalToken(internalToken));

  router.get("/resumes/:id", async (req, res, next) => {
    try {
      const resume = await resumeService.getResumeInternal({ resumeId: req.params.id });
      res.json({ resume });
    } catch (error) {
      next(error);
    }
  });

  router.get("/resumes/by-candidate/:candidateId", async (req, res, next) => {
    try {
      const resumes = await resumeService.listResumes({ candidateId: req.params.candidateId });
      res.json({ resumes });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
