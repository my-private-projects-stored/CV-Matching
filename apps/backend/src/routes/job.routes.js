import { Router } from "express";

import {
	createJobHandler,
	deleteJobHandler,
	getJobHandler,
	listJobsHandler,
	uploadJobDescriptionsHandler,
	updateJobHandler,
} from "../controllers/job.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.middleware.js";

const router = Router();
const requireAuthenticatedRole = [requireAuth, requireRoles("candidate", "recruiter", "admin")];
const requireRecruiterRole = [requireAuth, requireRoles("recruiter", "admin")];

router.post("/upload", ...requireAuthenticatedRole, uploadJobDescriptionsHandler);
router.get("/", ...requireAuthenticatedRole, listJobsHandler);
router.get("/:id", ...requireAuthenticatedRole, getJobHandler);
router.post("/", ...requireRecruiterRole, createJobHandler);
router.patch("/:id", ...requireRecruiterRole, updateJobHandler);
router.delete("/:id", ...requireRecruiterRole, deleteJobHandler);

export default router;
