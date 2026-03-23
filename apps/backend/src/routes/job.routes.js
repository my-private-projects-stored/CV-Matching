import { Router } from "express";

import {
	createJobHandler,
	deleteJobHandler,
	getJobHandler,
	listJobsHandler,
	uploadJobDescriptionsHandler,
	updateJobHandler,
} from "../controllers/job.controller.js";

const router = Router();

router.post("/upload", uploadJobDescriptionsHandler);
router.get("/", listJobsHandler);
router.get("/:id", getJobHandler);
router.post("/", createJobHandler);
router.patch("/:id", updateJobHandler);
router.delete("/:id", deleteJobHandler);

export default router;
