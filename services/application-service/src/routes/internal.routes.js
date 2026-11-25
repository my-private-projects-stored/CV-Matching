import express from "express";
import { requireInternalToken } from "../middleware/auth-context.js";

export function createInternalRoutes(applicationService, internalToken) {
  const router = express.Router();
  router.use(requireInternalToken(internalToken));

  router.post("/applications/:id/process-ai", async (req, res, next) => {
    try {
      const updated = await applicationService.processAiScoring({
        applicationId: req.params.id,
        semanticWeight: req.body?.semantic_weight,
        mockScoringResult: req.body?.mock_scoring_result || null,
      });

      res.json({
        request_id: req.requestId || `req_${Date.now()}`,
        data: {
          application_id: String(updated._id),
          ai_status: updated.aiStatus,
          scores: updated.aiScores,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/applications/:id/mark-failed", async (req, res, next) => {
    try {
      const updated = await applicationService.markScoringFailed({
        applicationId: req.params.id,
        errorMessage: req.body?.error,
      });
      res.json({
        data: {
          application_id: String(updated._id),
          ai_status: updated.aiStatus,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/access-check", async (req, res, next) => {
    try {
      const allowed = await applicationService.checkRecruiterAccess({
        recruiterId: req.query?.recruiterId,
        candidateId: req.query?.candidateId || null,
        resumeId: req.query?.resumeId || null,
      });
      res.json({ allowed });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
