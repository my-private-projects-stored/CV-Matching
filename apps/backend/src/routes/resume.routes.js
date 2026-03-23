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

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

router.post("/upload", upload.single("file"), uploadResumeHandler);
router.get("/list", listResumesHandler);
router.get("/master", getMasterResumeHandler);
router.get("/", getResumeHandler);
router.post("/", createResumeHandler);
router.post("/:id/set-as-master", setMasterResumeHandler);
router.post("/improve", improveResumeHandler);
router.post("/improve/preview", previewImproveResumeHandler);
router.post("/improve/confirm", confirmImproveResumeHandler);
router.post("/:id/retry-processing", retryResumeProcessingHandler);
router.post("/:id/generate-cover-letter", generateCoverLetterHandler);
router.post("/:id/generate-outreach", generateOutreachHandler);
router.get("/:id/pdf", downloadResumePdfHandler);
router.get("/:id/cover-letter/pdf", downloadCoverLetterPdfHandler);
router.get("/:id/download", downloadOriginalResumeHandler);
router.get("/:id/job-description", getResumeJobDescriptionHandler);
router.patch("/:id", updateResumeHandler);
router.patch("/:id/cover-letter", updateCoverLetterHandler);
router.patch("/:id/outreach-message", updateOutreachMessageHandler);
router.patch("/:id/title", updateResumeTitleHandler);
router.delete("/:id", deleteResumeHandler);

export default router;
