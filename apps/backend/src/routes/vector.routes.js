import { Router } from "express";

import {
  hybridScorePairHandler,
  indexJobVectorHandler,
  indexResumeVectorHandler,
  searchJobsByResumeVectorHandler,
  searchResumesByJobVectorHandler,
} from "../controllers/vector.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth, requireRoles("admin"));

router.post("/jobs/:jobId/index", indexJobVectorHandler);
router.post("/resumes/:resumeId/index", indexResumeVectorHandler);
router.post("/search/resumes", searchResumesByJobVectorHandler);
router.post("/search/jobs", searchJobsByResumeVectorHandler);
router.post("/score/pair", hybridScorePairHandler);

export default router;
