import express from "express";
import { ROLES } from "@cvm/shared";
import { requireRole } from "../middleware/auth-context.js";

export function createUserRoutes(authService) {
  const router = express.Router();

  router.use(requireRole(ROLES.TECH_STAFF, ROLES.PLATFORM_OWNER));

  router.get("/", async (req, res, next) => {
    try {
      const result = await authService.listUsers(req.query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/status", async (req, res, next) => {
    try {
      const result = await authService.updateUserStatus({
        actorId: req.auth.id,
        actorRole: req.auth.role,
        targetUserId: req.params.id,
        disabled: Boolean(req.body?.disabled),
        reason: req.body?.reason,
        requestId: req.requestId || "",
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/suspend", async (req, res, next) => {
    try {
      const result = await authService.suspendUser({
        actorId: req.auth.id,
        actorRole: req.auth.role,
        targetUserId: req.params.id,
        reason: req.body?.reason,
        requestId: req.requestId || "",
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/unsuspend", async (req, res, next) => {
    try {
      const result = await authService.unsuspendUser({
        actorId: req.auth.id,
        actorRole: req.auth.role,
        targetUserId: req.params.id,
        reason: req.body?.reason,
        requestId: req.requestId || "",
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/role", async (req, res, next) => {
    try {
      const result = await authService.updateUserRole({
        actorId: req.auth.id,
        actorRole: req.auth.role,
        targetUserId: req.params.id,
        role: req.body?.role,
        reason: req.body?.reason,
        requestId: req.requestId || "",
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
