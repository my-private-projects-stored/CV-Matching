import { Router } from "express";
import multer from "multer";

import {
  confirmImproveResumeHandler,
  createResumeHandler,
  deleteResumeHandler,
  downloadCoverLetterPdfHandler,
  downloadOriginalResumeHandler,
  downloadResumePdfHandler,
  generateCoverLetterHandler,
  generateOutreachHandler,
  getMasterResumeHandler,
  getResumeHandler,
  getResumeJobDescriptionHandler,
  improveResumeHandler,
  listResumesHandler,
  previewImproveResumeHandler,
  retryResumeProcessingHandler,
  setMasterResumeHandler,
  updateCoverLetterHandler,
  updateOutreachMessageHandler,
  updateResumeHandler,
  updateResumeTitleHandler,
  uploadResumeHandler,
} from "../controllers/resume.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.middleware.js";

const router = Router();
const requireCandidateRole = [requireRoles("candidate", "admin")];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

router.use(requireAuth);

router.post("/upload", ...requireCandidateRole, upload.single("file"), uploadResumeHandler);
router.get("/list", listResumesHandler);
router.get("/master", getMasterResumeHandler);
router.get("/", getResumeHandler);
router.post("/", ...requireCandidateRole, createResumeHandler);
router.post("/:id/set-as-master", ...requireCandidateRole, setMasterResumeHandler);
router.post("/improve", ...requireCandidateRole, improveResumeHandler);
router.post("/improve/preview", ...requireCandidateRole, previewImproveResumeHandler);
router.post("/improve/confirm", ...requireCandidateRole, confirmImproveResumeHandler);
router.post("/:id/retry-processing", ...requireCandidateRole, retryResumeProcessingHandler);
router.post("/:id/generate-cover-letter", ...requireCandidateRole, generateCoverLetterHandler);
router.post("/:id/generate-outreach", ...requireCandidateRole, generateOutreachHandler);
router.get("/:id/pdf", downloadResumePdfHandler);
router.get("/:id/cover-letter/pdf", downloadCoverLetterPdfHandler);
router.get("/:id/download", downloadOriginalResumeHandler);
router.get("/:id/job-description", getResumeJobDescriptionHandler);
router.patch("/:id", ...requireCandidateRole, updateResumeHandler);
router.patch("/:id/cover-letter", ...requireCandidateRole, updateCoverLetterHandler);
router.patch("/:id/outreach-message", ...requireCandidateRole, updateOutreachMessageHandler);
router.patch("/:id/title", ...requireCandidateRole, updateResumeTitleHandler);
router.delete("/:id", ...requireCandidateRole, deleteResumeHandler);

export default router;
