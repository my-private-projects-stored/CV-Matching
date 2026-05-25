import { Router } from "express";

import {
  getCompanyProfileByIdHandler,
  getMyCompanyProfileHandler,
  updateMyCompanyProfileHandler,
} from "../controllers/company.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/me", requireAuth, requireRoles("recruiter", "admin"), getMyCompanyProfileHandler);
router.put("/me", requireAuth, requireRoles("recruiter", "admin"), updateMyCompanyProfileHandler);
router.get("/:id", requireAuth, getCompanyProfileByIdHandler);

export default router;
