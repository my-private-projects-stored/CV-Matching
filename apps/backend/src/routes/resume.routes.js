import { Router } from "express";
import multer from "multer";

import {
  confirmImproveResumeHandler,
  createResumeHandler,
  addResumeSectionHandler,
  deleteResumeHandler,
  deleteResumeSectionHandler,
  downloadCoverLetterPdfHandler,
  downloadOriginalResumeHandler,
  downloadResumePdfHandler,
  generateCoverLetterHandler,
  generateOutreachHandler,
  getMasterResumeHandler,
  getResumeHandler,
  getResumeHistoryHandler,
  getResumeJobDescriptionHandler,
  matchResumeToJobDescriptionHandler,
  improveResumeHandler,
  listResumesHandler,
  previewImproveResumeHandler,
  reorderResumeSectionsHandler,
  restoreFromVersionHandler,
  retryResumeProcessingHandler,
  setMasterResumeHandler,
  updateCoverLetterHandler,
  updateOutreachMessageHandler,
  updateResumeHandler,
  updateResumeSectionHandler,
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
router.get("/:id/history", getResumeHistoryHandler);
router.post("/", ...requireCandidateRole, createResumeHandler);
router.post("/:id/set-as-master", ...requireCandidateRole, setMasterResumeHandler);
router.put("/:id/restore/:versionId", ...requireCandidateRole, restoreFromVersionHandler);
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
router.post("/:id/jd-match", ...requireCandidateRole, matchResumeToJobDescriptionHandler);
router.patch("/:id/sections/reorder", ...requireCandidateRole, reorderResumeSectionsHandler);
router.post("/:id/sections", ...requireCandidateRole, addResumeSectionHandler);
router.patch("/:id/sections/:sectionId", ...requireCandidateRole, updateResumeSectionHandler);
router.delete("/:id/sections/:sectionId", ...requireCandidateRole, deleteResumeSectionHandler);
router.patch("/:id", ...requireCandidateRole, updateResumeHandler);
router.patch("/:id/cover-letter", ...requireCandidateRole, updateCoverLetterHandler);
router.patch("/:id/outreach-message", ...requireCandidateRole, updateOutreachMessageHandler);
router.patch("/:id/title", ...requireCandidateRole, updateResumeTitleHandler);
router.delete("/:id", ...requireCandidateRole, deleteResumeHandler);

export default router;
