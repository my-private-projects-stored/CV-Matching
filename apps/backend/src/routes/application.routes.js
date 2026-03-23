import { Router } from "express";

import {
  createApplicationHandler,
  getApplicationFeedbackHandler,
  getApplicationStatusHistoryHandler,
  getApplicationSummaryHandler,
  listRecentStatusChangesHandler,
  listApplicationHistoryHandler,
  listRankedApplicationsHandler,
  updateApplicationStatusHandler,
} from "../controllers/application.controller.js";

const router = Router();

router.post("/", createApplicationHandler);
router.get("/ranked", listRankedApplicationsHandler);
router.get("/history", listApplicationHistoryHandler);
router.get("/summary", getApplicationSummaryHandler);
router.get("/status-changes", listRecentStatusChangesHandler);
router.get("/:id/feedback", getApplicationFeedbackHandler);
router.get("/:id/status-history", getApplicationStatusHistoryHandler);
router.patch("/:id/status", updateApplicationStatusHandler);

export default router;
