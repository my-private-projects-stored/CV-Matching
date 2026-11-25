import express from "express";
import { ROLES } from "@cvm/shared";
import { requireAuth, requireRole } from "../middleware/auth-context.js";

export function createCandidateProfileRoutes(authService) {
  const router = express.Router();

  router.get("/me", requireAuth, requireRole(ROLES.CANDIDATE, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const data = await authService.getCandidateProfile({ userId: req.auth.id });
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.put("/me", requireAuth, requireRole(ROLES.CANDIDATE, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const data = await authService.updateCandidateProfile({
        userId: req.auth.id,
        profile: req.body || {},
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:userId", requireAuth, async (req, res, next) => {
    try {
      const data = await authService.getCandidateProfileForViewer({
        viewer: req.auth,
        targetUserId: req.params.userId,
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
