import express from "express";
import { requireAuth } from "../middleware/auth-context.js";

export function createNotificationRoutes(notificationService, sseHub) {
  const router = express.Router();

  router.get("/stream", requireAuth, async (req, res, next) => {
    try {
      const lastEventId =
        req.headers["last-event-id"] || req.query?.lastEventId || null;

      sseHub.addClient(req.auth.id, req, res);

      if (lastEventId) {
        const missed = await notificationService.getMissedSince({
          userId: req.auth.id,
          lastEventId: String(lastEventId),
        });
        for (const notif of missed) {
          sseHub.sendNotification(res, notif);
        }
      }
    } catch (error) {
      next(error);
    }
  });

  router.get("/", requireAuth, async (req, res, next) => {
    try {
      const result = await notificationService.listForUser({
        userId: req.auth.id,
        limit: req.query?.limit,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/unread-count", requireAuth, async (req, res, next) => {
    try {
      const result = await notificationService.getUnreadCount({ userId: req.auth.id });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/read-all", requireAuth, async (req, res, next) => {
    try {
      const result = await notificationService.markAllRead({ userId: req.auth.id });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/read", requireAuth, async (req, res, next) => {
    try {
      const result = await notificationService.markRead({
        notificationId: req.params.id,
        userId: req.auth.id,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
