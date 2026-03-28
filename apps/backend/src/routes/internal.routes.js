import { Router } from "express";

import { processApplicationAiHandler } from "../controllers/internal-application.controller.js";

const router = Router();

router.post("/applications/:id/process-ai", processApplicationAiHandler);

export default router;
