import { Router } from "express";

import { listUsersHandler, updateUserStatusHandler } from "../controllers/user.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth, requireRoles("admin"));
router.get("/", listUsersHandler);
router.patch("/:id/status", updateUserStatusHandler);

export default router;
