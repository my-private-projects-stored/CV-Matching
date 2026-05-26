import { Router } from "express";

import {
  getJobRecommendationsHandler,
  getResumeRecommendationsHandler,
} from "../controllers/recommendation.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.middleware.js";

const router = Router();

// Feature A: Candidate — find matching Jobs from their CV
// GET /api/recommendations/jobs?resume_id=<id>&limit=10&score_threshold=0&semantic_weight=0.65
router.get(
  "/jobs",
  requireAuth,
  requireRoles("candidate", "admin"),
  getJobRecommendationsHandler
);

// Feature B: Recruiter — find matching CVs from their Job JD
// GET /api/recommendations/resumes?job_id=<id>&limit=10&score_threshold=0&semantic_weight=0.65
router.get(
  "/resumes",
  requireAuth,
  requireRoles("recruiter", "admin"),
  getResumeRecommendationsHandler
);

export default router;
