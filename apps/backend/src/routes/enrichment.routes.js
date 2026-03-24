import { Router } from "express";

import {
  analyzeResumeHandler,
  applyEnhancementsHandler,
  applyRegeneratedItemsHandler,
  enhanceResumeHandler,
  regenerateItemsHandler,
} from "../controllers/enrichment.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth, requireRoles("candidate", "admin"));

router.post("/analyze/:resumeId", analyzeResumeHandler);
router.post("/enhance", enhanceResumeHandler);
router.post("/apply/:resumeId", applyEnhancementsHandler);
router.post("/regenerate", regenerateItemsHandler);
router.post("/apply-regenerated/:resumeId", applyRegeneratedItemsHandler);

export default router;
