import { Router } from "express";

import { getSystemStatusHandler } from "../controllers/config.controller.js";
import applicationRoutes from "./application.routes.js";
import authRoutes from "./auth.routes.js";
import candidateProfileRoutes from "./candidate-profile.routes.js";
import configRoutes from "./config.routes.js";
import enrichmentRoutes from "./enrichment.routes.js";
import internalRoutes from "./internal.routes.js";
import jobRoutes from "./job.routes.js";
import resumeRoutes from "./resume.routes.js";
import vectorRoutes from "./vector.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

router.get("/status", getSystemStatusHandler);

router.use("/auth", authRoutes);
router.use("/candidate-profile", candidateProfileRoutes);
router.use("/jobs", jobRoutes);
router.use("/resumes", resumeRoutes);
router.use("/applications", applicationRoutes);
router.use("/vectors", vectorRoutes);
router.use("/config", configRoutes);
router.use("/enrichment", enrichmentRoutes);
router.use("/internal", internalRoutes);

export default router;
