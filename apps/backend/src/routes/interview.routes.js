import { Router } from "express";

import { generateInterviewQuestionsHandler } from "../controllers/interview.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.middleware.js";

const router = Router();

// Feature C: Recruiter — generate interview questions from candidate CV (+ optional JD)
// POST /api/interviews/questions
// Body: { resume_id: string, job_id?: string, language?: "en" | "vi" }
router.post(
  "/questions",
  requireAuth,
  requireRoles("recruiter", "admin"),
  generateInterviewQuestionsHandler
);

export default router;
