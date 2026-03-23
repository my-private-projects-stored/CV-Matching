import { Router } from "express";

import { getSystemStatusHandler } from "../controllers/config.controller.js";
import applicationRoutes from "./application.routes.js";
import configRoutes from "./config.routes.js";
import enrichmentRoutes from "./enrichment.routes.js";
import jobRoutes from "./job.routes.js";
import resumeRoutes from "./resume.routes.js";
import vectorRoutes from "./vector.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

router.get("/status", getSystemStatusHandler);

router.use("/jobs", jobRoutes);
router.use("/resumes", resumeRoutes);
router.use("/applications", applicationRoutes);
router.use("/vectors", vectorRoutes);
router.use("/config", configRoutes);
router.use("/enrichment", enrichmentRoutes);

export default router;
