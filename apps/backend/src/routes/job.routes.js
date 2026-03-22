import { Router } from "express";

import {
	createJobHandler,
	deleteJobHandler,
	updateJobHandler,
} from "../controllers/job.controller.js";

const router = Router();

router.post("/", createJobHandler);
router.patch("/:id", updateJobHandler);
router.delete("/:id", deleteJobHandler);

export default router;
