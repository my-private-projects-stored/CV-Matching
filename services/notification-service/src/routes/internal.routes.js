import express from "express";
import { requireInternalToken } from "../middleware/auth-context.js";

export function createInternalRoutes(notificationService, internalToken) {
  const router = express.Router();
  router.use(requireInternalToken(internalToken));

  router.post("/notifications/:id/email-sent", async (req, res, next) => {
    try {
      const result = await notificationService.markEmailSent({
        notificationId: req.params.id,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
