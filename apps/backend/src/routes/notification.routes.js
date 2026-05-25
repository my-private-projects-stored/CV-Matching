import { Router } from "express";

import {
  getUnreadCountHandler,
  listNotificationsHandler,
  markAllNotificationsReadHandler,
  markNotificationReadHandler,
} from "../controllers/notification.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, listNotificationsHandler);
router.get("/unread-count", requireAuth, getUnreadCountHandler);
router.patch("/read-all", requireAuth, markAllNotificationsReadHandler);
router.patch("/:id/read", requireAuth, markNotificationReadHandler);

export default router;
