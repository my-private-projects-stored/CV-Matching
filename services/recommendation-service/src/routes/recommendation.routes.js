import express from "express";
import { ROLES } from "@cvm/shared";
import { requireAuth, requireRole } from "../middleware/auth-context.js";

export function createRecommendationRoutes(recommendationService) {
  const router = express.Router();

  router.get("/search", async (req, res, next) => {
    try {
      const skills = req.query?.skills
        ? String(req.query.skills).split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const result = await recommendationService.searchJobs({
        query: req.query?.q || req.query?.query || "",
        category: req.query?.category || "",
        location: req.query?.location || "",
        skills,
        page: req.query?.page,
        limit: req.query?.limit,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/jobs", requireAuth, requireRole(ROLES.CANDIDATE, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const result = await recommendationService.recommendJobsForResume({
        resumeId: req.query?.resume_id || req.query?.resumeId,
        limit: req.query?.limit,
        scoreThreshold: req.query?.score_threshold,
        semanticWeight: req.query?.semantic_weight,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/resumes", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const result = await recommendationService.recommendResumesForJob({
        jobId: req.query?.job_id || req.query?.jobId,
        limit: req.query?.limit,
        scoreThreshold: req.query?.score_threshold,
        semanticWeight: req.query?.semantic_weight,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/jobs/:jobId/index", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      res.json(await recommendationService.indexJobVector({ jobId: req.params.jobId, vector: req.body?.vector, payload: req.body?.payload }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/resumes/:resumeId/index", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      res.json(await recommendationService.indexResumeVector({ resumeId: req.params.resumeId, vector: req.body?.vector, payload: req.body?.payload }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/search/resumes", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const matches = await recommendationService.searchResumesByVector(req.body || {});
      res.json({ matches, data: matches });
    } catch (error) {
      next(error);
    }
  });

  router.post("/search/jobs", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const matches = await recommendationService.searchJobsByVector(req.body || {});
      res.json({ matches, data: matches });
    } catch (error) {
      next(error);
    }
  });

  router.post("/score/pair", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      res.json(await recommendationService.scorePair({ jobId: req.body?.job_id, resumeId: req.body?.resume_id }));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
