import { Router } from "express";

import {
  getMyCandidateProfileHandler,
  updateMyCandidateProfileHandler,
} from "../controllers/candidate-profile.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/me", requireAuth, requireRoles("candidate", "admin"), getMyCandidateProfileHandler);
router.put("/me", requireAuth, requireRoles("candidate", "admin"), updateMyCandidateProfileHandler);

export default router;
