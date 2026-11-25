import express from "express";
import { requireAuth } from "../middleware/auth-context.js";

function toUiQuestionGroups(questionSet, payload = {}) {
  const rawQuestions = Array.isArray(questionSet?.questions) ? questionSet.questions : [];
  const mapped = rawQuestions.map((q, idx) => ({
    id: `iq-${idx + 1}`,
    category: q.category || "technical",
    question: q.question || "",
    focus_skill: q.expectedSignal || null,
    context: {},
  }));
  return {
    resume_id: String(payload.resume_id || payload.resumeId || questionSet?.resumeId || ""),
    job_id: payload.job_id || payload.jobId || questionSet?.jobId || null,
    job_title: payload.jobTitle || payload.job_title || null,
    candidate_name: payload.candidate_name || "Candidate",
    candidate_title: payload.candidate_title || "",
    language: questionSet?.language || "vi",
    generated_at: questionSet?.createdAt || new Date().toISOString(),
    question_groups: [
      {
        group: "all",
        label: "Interview Questions",
        description: "Tailored questions generated for candidate evaluation.",
        questions: mapped,
      },
    ],
    total_questions: mapped.length,
    generation_mode: questionSet?.generationMode || "template_fallback",
  };
}

export function createInterviewRoutes(enrichmentService) {
  const router = express.Router();

  router.post("/questions", requireAuth, async (req, res, next) => {
    try {
      const result = await enrichmentService.generateInterviewQuestions({
        viewer: req.auth,
        payload: req.body || {},
        requestId: req.requestId || "",
      });
      res.status(201).json({
        ...result,
        data: toUiQuestionGroups(result.questionSet, req.body || {}),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/questions/:applicationId", requireAuth, async (req, res, next) => {
    try {
      const result = await enrichmentService.getInterviewQuestionsByApplication({
        applicationId: req.params.applicationId,
        viewer: req.auth,
        audience: req.query?.audience || null,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
