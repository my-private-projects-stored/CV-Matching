import { Router } from "express";

import {
  createResumeHandler,
  deleteResumeHandler,
  updateResumeHandler,
} from "../controllers/resume.controller.js";

const router = Router();

router.post("/", createResumeHandler);
router.patch("/:id", updateResumeHandler);
router.delete("/:id", deleteResumeHandler);

export default router;
