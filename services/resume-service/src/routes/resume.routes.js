import express from "express";
import multer from "multer";
import { MAX_RESUME_UPLOAD_BYTES, ROLES } from "@cvm/shared";
import { requireAuth, requireRole } from "../middleware/auth-context.js";
import { hasMeaningfulStructuredData, parseRawTextToStructuredData } from "../services/resume-parser.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_UPLOAD_BYTES },
});

function toUiProcessingStatus(status) {
  if (status === "completed" || status === "ready") return "ready";
  if (status === "processing" || status === "failed") return status;
  return "pending";
}

function formatResumeListItem(doc) {
  return {
    resume_id: String(doc._id),
    candidate_id: doc.candidateId ? String(doc.candidateId) : null,
    filename: doc.fileName || doc.title || null,
    is_master: Boolean(doc.isMaster),
    parent_id: doc.parentId ? String(doc.parentId) : null,
    restored_from_version_id: doc.restoredFromVersionId || null,
    restored_at: doc.restoredAt || null,
    processing_status: toUiProcessingStatus(doc.processingStatus),
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
    title: doc.title || doc.fileName || "Untitled Resume",
  };
}

function buildSimplePdfBuffer(title = "Document", lines = []) {
  const safe = [title, ...lines]
    .map((line) => String(line || "").replace(/[^\x20-\x7E]/g, " ").replace(/[()\\]/g, "").slice(0, 90))
    .filter(Boolean)
    .slice(0, 20);
  const ops = safe.map((line, idx) => `BT /F1 11 Tf 50 ${740 - idx * 18} Td (${line}) Tj ET`).join("\n");
  const objs = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(ops, "utf8")} >>\nstream\n${ops}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objs) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

function formatResumeDetail(doc) {
  const hasParsedData = hasMeaningfulStructuredData(doc.parsedData);
  const builderSections =
    doc.builderData?.sections &&
    typeof doc.builderData.sections === "object" &&
    Object.keys(doc.builderData.sections).length > 0
      ? {
          ...doc.builderData.sections,
          sectionMeta: doc.builderData.sectionMeta,
          customSections: doc.builderData.customSections,
        }
      : null;

  const processedResume =
    builderSections ||
    (hasParsedData ? doc.parsedData : null) ||
    (doc.rawText ? parseRawTextToStructuredData(doc.rawText) : null);

  return {
    resume_id: String(doc._id),
    candidate_id: doc.candidateId ? String(doc.candidateId) : null,
    title: doc.title || doc.fileName || "Untitled Resume",
    raw_resume: {
      id: null,
      content: doc.rawText || "",
      content_type: doc.mimeType || "text/plain",
      created_at: doc.createdAt,
      processing_status: toUiProcessingStatus(doc.processingStatus),
    },
    processed_resume: processedResume,
    builder_data: doc.builderData || null,
    cover_letter: doc.coverLetter || null,
    coverLetter: doc.coverLetter || null,
    outreach_message: doc.outreachMessage || null,
    outreachMessage: doc.outreachMessage || null,
    parent_id: doc.parentId ? String(doc.parentId) : null,
    restored_from_version_id: doc.restoredFromVersionId || null,
    restored_at: doc.restoredAt || null,
  };
}

export function createResumeRoutes(resumeService) {
  const router = express.Router();

  router.post(
    "/upload",
    requireAuth,
    requireRole(ROLES.CANDIDATE, ROLES.TECH_STAFF),
    upload.single("file"),
    async (req, res, next) => {
      try {
        const result = await resumeService.uploadResume({
          candidateId: req.auth.id,
          file: req.file,
          title: req.body?.title,
        });
        res.status(201).json({
          ...result,
          request_id: req.requestId || "",
          message: "Resume uploaded successfully",
          resume_id: String(result.resume._id),
          processing_status: toUiProcessingStatus(result.resume.processingStatus),
          is_master: Boolean(result.resume.isMaster),
          data: formatResumeListItem(result.resume),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Register static sub-routes BEFORE /:id so Express never casts "list"/"master" to ObjectId
  router.get("/list", requireAuth, async (req, res, next) => {
    try {
      const resumes = await resumeService.listResumes({ candidateId: req.auth.id });
      res.json({
        request_id: req.requestId || "",
        resumes,
        data: resumes.map(formatResumeListItem),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/master", requireAuth, async (req, res, next) => {
    try {
      const targetCandidateId =
        req.query?.candidate_id && req.auth.role !== ROLES.CANDIDATE
          ? String(req.query.candidate_id)
          : req.auth.id;
      const resume = await resumeService.getMasterResume({ candidateId: targetCandidateId });
      res.json({
        request_id: req.requestId || "",
        resume,
        data: formatResumeListItem(resume),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/", requireAuth, async (req, res, next) => {
    try {
      if (req.query?.resume_id) {
        const resume = await resumeService.getResumeById({
          resumeId: String(req.query.resume_id),
          viewer: req.auth,
        });
        return res.json({
          request_id: req.requestId || "",
          resume,
          data: formatResumeDetail(resume),
        });
      }
      const resumes = await resumeService.listResumes({ candidateId: req.auth.id });
      return res.json({
        request_id: req.requestId || "",
        resumes,
        data: resumes.map(formatResumeListItem),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post(
    "/",
    requireAuth,
    requireRole(ROLES.CANDIDATE, ROLES.TECH_STAFF),
    async (req, res, next) => {
      try {
        const resume = await resumeService.createBuilderResume({
          candidateId: req.auth.id,
          payload: req.body || {},
        });
        res.status(201).json({
          request_id: req.requestId || "",
          resume,
          data: formatResumeDetail(resume),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get("/:id", requireAuth, async (req, res, next) => {
    try {
      const resume = await resumeService.getResumeById({
        resumeId: req.params.id,
        viewer: req.auth,
      });
      res.json({
        request_id: req.requestId || "",
        resume,
        data: formatResumeDetail(resume),
      });
    } catch (error) {
      next(error);
    }
  });

  async function handleUpdate(req, res, next) {
    try {
      const resume = await resumeService.updateResume({
        resumeId: req.params.id,
        candidateId: req.auth.id,
        payload: req.body || {},
      });
      res.json({
        request_id: req.requestId || "",
        resume,
        data: formatResumeDetail(resume),
      });
    } catch (error) {
      next(error);
    }
  }

  router.put("/:id", requireAuth, handleUpdate);
  router.patch("/:id", requireAuth, handleUpdate);

  router.patch("/:id/title", requireAuth, async (req, res, next) => {
    try {
      const resume = await resumeService.updateResume({
        resumeId: req.params.id,
        candidateId: req.auth.id,
        payload: { title: req.body?.title },
      });
      res.json({ request_id: req.requestId || "", resume, data: formatResumeListItem(resume) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/cover-letter", requireAuth, async (req, res, next) => {
    try {
      const resume = await resumeService.updateResume({
        resumeId: req.params.id,
        candidateId: req.auth.id,
        payload: { coverLetter: req.body?.content ?? "" },
      });
      res.json({ request_id: req.requestId || "", resume, data: formatResumeDetail(resume) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/outreach-message", requireAuth, async (req, res, next) => {
    try {
      const resume = await resumeService.updateResume({
        resumeId: req.params.id,
        candidateId: req.auth.id,
        payload: { outreachMessage: req.body?.content ?? "" },
      });
      res.json({ request_id: req.requestId || "", resume, data: formatResumeDetail(resume) });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", requireAuth, async (req, res, next) => {
    try {
      const result = await resumeService.deleteResume({
        resumeId: req.params.id,
        candidateId: req.auth.id,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  async function handleSetMaster(req, res, next) {
    try {
      const resume = await resumeService.setMasterResume({
        resumeId: req.params.id,
        candidateId: req.auth.id,
      });
      res.json({
        request_id: req.requestId || "",
        resume,
        data: formatResumeListItem(resume),
      });
    } catch (error) {
      next(error);
    }
  }

  router.patch("/:id/master", requireAuth, handleSetMaster);
  router.post("/:id/set-as-master", requireAuth, handleSetMaster);

  async function handleHistory(req, res, next) {
    try {
      const [resume, versions] = await Promise.all([
        resumeService.getResumeById({ resumeId: req.params.id, viewer: req.auth }),
        resumeService.listVersions({
          resumeId: req.params.id,
          candidateId: req.auth.id,
        }),
      ]);
      const headItem = formatResumeListItem(resume);
      const snapshotItems = [...(versions || [])].reverse().map((v) => ({
        resume_id: String(v.versionId),
        versionId: String(v.versionId),
        candidate_id: resume.candidateId ? String(resume.candidateId) : null,
        filename: resume.fileName || null,
        is_master: false,
        parent_id: String(resume._id),
        processing_status: "ready",
        created_at: v.savedAt || resume.createdAt,
        updated_at: v.savedAt || resume.updatedAt,
        title: v.title || resume.title || "Untitled Resume",
      }));
      res.json({
        request_id: req.requestId || "",
        versions,
        data: {
          resume_id: req.params.id,
          candidate_id: req.auth.id,
          root_resume_id: req.params.id,
          current_resume_id: String(resume._id),
          versions: [headItem, ...snapshotItems],
        },
      });
    } catch (error) {
      next(error);
    }
  }

  router.get("/:id/versions", requireAuth, handleHistory);
  router.get("/:id/history", requireAuth, handleHistory);

  async function handleRestore(req, res, next) {
    try {
      const resume = await resumeService.restoreVersion({
        resumeId: req.params.id,
        candidateId: req.auth.id,
        versionId: req.params.versionId,
      });
      res.json({
        request_id: req.requestId || "",
        resume,
        data: formatResumeListItem(resume),
      });
    } catch (error) {
      next(error);
    }
  }

  router.post("/:id/versions/:versionId/restore", requireAuth, handleRestore);
  router.put("/:id/restore/:versionId", requireAuth, handleRestore);

  router.post("/:id/retry-processing", requireAuth, async (req, res, next) => {
    try {
      const resume = await resumeService.retryProcessing({
        resumeId: req.params.id,
        candidateId: req.auth.id,
      });
      res.json({
        request_id: req.requestId || "",
        message: "Resume processing retried",
        resume_id: String(resume._id),
        processing_status: toUiProcessingStatus(resume.processingStatus),
        is_master: Boolean(resume.isMaster),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/pdf", requireAuth, async (req, res, next) => {
    try {
      const resume = await resumeService.getResumeById({ resumeId: req.params.id, viewer: req.auth });
      const lines = String(resume.rawText || "").split(/\r?\n/).filter(Boolean);
      const buf = buildSimplePdfBuffer(resume.title || resume.fileName || "Resume", lines);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="resume-${req.params.id}.pdf"`);
      res.send(buf);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/cover-letter/pdf", requireAuth, async (req, res, next) => {
    try {
      const resume = await resumeService.getResumeById({ resumeId: req.params.id, viewer: req.auth });
      const lines = String(resume.coverLetter || "Cover Letter").split(/\r?\n/).filter(Boolean);
      const buf = buildSimplePdfBuffer(`Cover Letter - ${resume.title || "Resume"}`, lines);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="cover-letter-${req.params.id}.pdf"`);
      res.send(buf);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/job-description", requireAuth, async (req, res, next) => {
    try {
      await resumeService.getResumeById({ resumeId: req.params.id, viewer: req.auth });
      res.json({ job_id: "", content: "" });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/sections/reorder", requireAuth, async (req, res, next) => {
    try {
      const current = await resumeService.getResumeById({ resumeId: req.params.id, viewer: req.auth });
      const sectionIds = Array.isArray(req.body?.section_ids) ? req.body.section_ids : [];
      const builderData = { ...(current.builderData || {}), sectionOrder: sectionIds };
      const resume = await resumeService.updateResume({
        resumeId: req.params.id,
        candidateId: req.auth.id,
        payload: { builderData },
      });
      res.json({ request_id: req.requestId || "", resume, data: formatResumeDetail(resume) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/sections", requireAuth, async (req, res, next) => {
    try {
      const current = await resumeService.getResumeById({ resumeId: req.params.id, viewer: req.auth });
      const existingCustom = { ...(current.builderData?.customSections || {}) };
      const key = String(req.body?.key || `custom_${Date.now()}`);
      existingCustom[key] = req.body?.content ?? req.body ?? {};
      const builderData = { ...(current.builderData || {}), customSections: existingCustom };
      const resume = await resumeService.updateResume({
        resumeId: req.params.id,
        candidateId: req.auth.id,
        payload: { builderData },
      });
      res.json({ request_id: req.requestId || "", resume, data: formatResumeDetail(resume) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/sections/:sectionId", requireAuth, async (req, res, next) => {
    try {
      const current = await resumeService.getResumeById({ resumeId: req.params.id, viewer: req.auth });
      const existingCustom = { ...(current.builderData?.customSections || {}) };
      existingCustom[req.params.sectionId] = req.body?.content ?? req.body ?? {};
      const builderData = { ...(current.builderData || {}), customSections: existingCustom };
      const resume = await resumeService.updateResume({
        resumeId: req.params.id,
        candidateId: req.auth.id,
        payload: { builderData },
      });
      res.json({ request_id: req.requestId || "", resume, data: formatResumeDetail(resume) });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id/sections/:sectionId", requireAuth, async (req, res, next) => {
    try {
      const current = await resumeService.getResumeById({ resumeId: req.params.id, viewer: req.auth });
      const existingCustom = { ...(current.builderData?.customSections || {}) };
      delete existingCustom[req.params.sectionId];
      const builderData = { ...(current.builderData || {}), customSections: existingCustom };
      const resume = await resumeService.updateResume({
        resumeId: req.params.id,
        candidateId: req.auth.id,
        payload: { builderData },
      });
      res.json({ request_id: req.requestId || "", resume, data: formatResumeDetail(resume) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/download", requireAuth, async (req, res, next) => {
    try {
      const streamMode = String(req.query?.mode || "url").toLowerCase() === "stream";
      const access = await resumeService.getDownloadAccess({
        resumeId: req.params.id,
        viewer: req.auth,
        stream: streamMode,
      });

      if (streamMode) {
        res.setHeader("Content-Type", access.mimeType);
        res.setHeader("Content-Disposition", `attachment; filename="${access.fileName}"`);
        return res.send(access.buffer);
      }

      return res.json(access);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
