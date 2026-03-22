import { Router } from "express";

import jobRoutes from "./job.routes.js";
import resumeRoutes from "./resume.routes.js";
import vectorRoutes from "./vector.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

router.use("/jobs", jobRoutes);
router.use("/resumes", resumeRoutes);
router.use("/vectors", vectorRoutes);

export default router;
