import { Router } from "express";

import {
  bulkUpdateApplicationStatusHandler,
  createApplicationHandler,
  exportRecentStatusChangesCsvHandler,
  getApplicationFeedbackHandler,
  getApplicationStatusHistoryHandler,
  getApplicationSummaryHandler,
  listRecentStatusChangesHandler,
  listApplicationHistoryHandler,
  listRankedApplicationsHandler,
  updateApplicationStatusHandler,
} from "../controllers/application.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.middleware.js";

const router = Router();
const requireRecruiterRole = [requireAuth, requireRoles("recruiter", "admin")];
const requireCandidateRole = [requireAuth, requireRoles("candidate", "admin")];

router.post("/", ...requireCandidateRole, createApplicationHandler);
router.get("/ranked", ...requireRecruiterRole, listRankedApplicationsHandler);
router.get("/history", requireAuth, listApplicationHistoryHandler);
router.get("/summary", ...requireRecruiterRole, getApplicationSummaryHandler);
router.get("/status-changes/export", ...requireRecruiterRole, exportRecentStatusChangesCsvHandler);
router.get("/status-changes", ...requireRecruiterRole, listRecentStatusChangesHandler);
router.patch("/status/bulk", ...requireRecruiterRole, bulkUpdateApplicationStatusHandler);
router.get("/:id/feedback", requireAuth, getApplicationFeedbackHandler);
router.get("/:id/status-history", requireAuth, getApplicationStatusHistoryHandler);
router.patch("/:id/status", ...requireRecruiterRole, updateApplicationStatusHandler);

export default router;
