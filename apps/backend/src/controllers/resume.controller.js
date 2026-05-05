import {
  confirmResumeImprovement,
  createResumeFromUpload,
  createResume,
  deleteResumeById,
  downloadOriginalResumeFile,
  getMasterResume,
  generateCoverLetterPdf,
  generateCoverLetterContent,
  generateResumePdf,
  generateOutreachContent,
  getResumeByPublicId,
  getResumeVersionHistory,
  improveResume,
  listResumeSummaries,
  previewResumeImprovement,
  restoreFromVersion,
  retryResumeProcessing,
  setResumeAsMaster,
  toResumeFetchData,
  toResumeSummary,
  updateResumeById,
  updateResumeFields,
} from "../services/resume.service.js";
import { assertAiGenerationAllowed, getLanguageConfig } from "../services/config.service.js";

const SUPPORTED_OUTPUT_LANGUAGES = new Set(["en", "vi"]);

function resolveOutputLanguage(value, fallback = "en") {
  const normalized = String(value || "").trim().toLowerCase();
  if (SUPPORTED_OUTPUT_LANGUAGES.has(normalized)) {
    return normalized;
  }

  const fallbackNormalized = String(fallback || "").trim().toLowerCase();
  if (SUPPORTED_OUTPUT_LANGUAGES.has(fallbackNormalized)) {
    return fallbackNormalized;
  }

  return "en";
}

function requestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getAuthRole(req) {
  return String(req.auth?.role || "").trim().toLowerCase();
}

function getAuthUserId(req) {
  return String(req.auth?.userId || "").trim();
}

function isCandidateRole(req) {
  return getAuthRole(req) === "candidate";
}

function isOwnedByActor(resume, req) {
  return String(resume?.candidateId || "") === getAuthUserId(req);
}

function getResumePayloadFromPatchBody(body = {}) {
  const modelKeys = new Set([
    "candidateId",
    "fileUrl",
    "rawText",
    "qdrantId",
    "parsedData",
    "isAnalyzed",
    "processingStatus",
    "filename",
    "isMaster",
    "parentResumeId",
    "title",
    "coverLetter",
    "outreachMessage",
    "jobDescription",
    "jobId",
  ]);

  const hasModelKeys = Object.keys(body).some((key) => modelKeys.has(key));
  if (hasModelKeys) {
    return body;
  }

  return {
    parsedData: body,
    processingStatus: "ready",
  };
}

export async function uploadResumeHandler(req, res, next) {
  try {
    const result = await createResumeFromUpload(req.file, getAuthUserId(req));
    return res.status(201).json({
      ...result,
      request_id: requestId(),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getResumeHandler(req, res, next) {
  try {
    const resumeId = String(req.query.resume_id || "").trim();
    if (!resumeId) {
      return res.status(400).json({ message: "resume_id query parameter is required" });
    }

    const resume = await getResumeByPublicId(resumeId);
    if (!resume) {
      return res.status(404).json({ message: "Resume not found" });
    }

    if (isCandidateRole(req) && !isOwnedByActor(resume, req)) {
      return res.status(403).json({ message: "You can only access your own resume" });
    }

    return res.status(200).json({
      request_id: requestId(),
      data: toResumeFetchData(resume),
    });
  } catch (error) {
    return next(error);
  }
}

export async function listResumesHandler(req, res, next) {
  try {
    const includeMaster = String(req.query.include_master || "false").toLowerCase() === "true";
    const candidateId = isCandidateRole(req) ? getAuthUserId(req) : undefined;
    const data = await listResumeSummaries(includeMaster, candidateId);

    return res.status(200).json({
      request_id: requestId(),
      data,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getMasterResumeHandler(req, res, next) {
  try {
    const requestedCandidateId = String(req.query.candidate_id || "").trim();
    const candidateId = isCandidateRole(req) ? getAuthUserId(req) : requestedCandidateId;
    if (candidateId && !/^[a-fA-F0-9]{24}$/.test(candidateId)) {
      return res.status(400).json({ message: "candidate_id must be a valid ObjectId" });
    }

    const resume = await getMasterResume(candidateId || undefined);
    if (!resume) {
      return res.status(404).json({ message: "Master resume not found" });
    }

    return res.status(200).json({
      request_id: requestId(),
      data: toResumeSummary(resume),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getResumeHistoryHandler(req, res, next) {
  try {
    const resume = await getResumeByPublicId(req.params.id);
    if (!resume) {
      return res.status(404).json({ message: "Resume not found" });
    }

    if (isCandidateRole(req) && !isOwnedByActor(resume, req)) {
      return res.status(403).json({ message: "You can only access your own resume" });
    }

    const result = await getResumeVersionHistory(req.params.id);
    if (!result) {
      return res.status(404).json({ message: "Resume not found" });
    }

    return res.status(200).json({
      request_id: requestId(),
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function setMasterResumeHandler(req, res, next) {
  try {
    if (isCandidateRole(req)) {
      const resume = await getResumeByPublicId(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (!isOwnedByActor(resume, req)) {
        return res.status(403).json({ message: "You can only update your own resume" });
      }
    }

    const updated = await setResumeAsMaster(req.params.id);
    if (!updated) {
      return res.status(404).json({ message: "Resume not found" });
    }

    return res.status(200).json({
      request_id: requestId(),
      message: "Master resume updated successfully",
      data: toResumeSummary(updated),
    });
  } catch (error) {
    return next(error);
  }
}

export async function restoreFromVersionHandler(req, res, next) {
  try {
    const resumeId = req.params.id;
    const versionId = req.params.versionId;

    if (!resumeId || !versionId) {
      return res.status(400).json({ message: "Resume ID and version ID are required" });
    }

    if (isCandidateRole(req)) {
      const resume = await getResumeByPublicId(resumeId);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (!isOwnedByActor(resume, req)) {
        return res.status(403).json({ message: "You can only restore your own resume" });
      }
    }

    const restored = await restoreFromVersion(resumeId, versionId);
    if (!restored) {
      return res.status(404).json({ message: "Resume or version not found" });
    }

    return res.status(200).json({
      request_id: requestId(),
      message: "Resume restored successfully",
      data: toResumeSummary(restored),
    });
  } catch (error) {
    return next(error);
  }
}

export async function createResumeHandler(req, res, next) {
  try {
    const payload = { ...(req.body || {}) };
    if (isCandidateRole(req)) {
      payload.candidateId = getAuthUserId(req);
    }

    const created = await createResume(payload);
    return res.status(201).json({
      request_id: requestId(),
      data: toResumeFetchData(created),
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateResumeHandler(req, res, next) {
  try {
    if (isCandidateRole(req)) {
      const resume = await getResumeByPublicId(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (!isOwnedByActor(resume, req)) {
        return res.status(403).json({ message: "You can only update your own resume" });
      }
    }

    const payload = getResumePayloadFromPatchBody(req.body);
    const updated = await updateResumeById(req.params.id, payload);

    if (!updated) {
      return res.status(404).json({ message: "Resume not found" });
    }

    return res.status(200).json({
      request_id: requestId(),
      data: toResumeFetchData(updated),
    });
  } catch (error) {
    return next(error);
  }
}

export async function retryResumeProcessingHandler(req, res, next) {
  try {
    if (isCandidateRole(req)) {
      const resume = await getResumeByPublicId(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (!isOwnedByActor(resume, req)) {
        return res.status(403).json({ message: "You can only update your own resume" });
      }
    }

    const retried = await retryResumeProcessing(req.params.id);
    if (!retried) {
      return res.status(404).json({ message: "Resume not found" });
    }

    return res.status(200).json({
      ...retried,
      request_id: requestId(),
    });
  } catch (error) {
    return next(error);
  }
}

export async function previewImproveResumeHandler(req, res, next) {
  try {
    await assertAiGenerationAllowed("resume_tailor_preview");

    const resumeId = String(req.body?.resume_id || "").trim();
    const jobId = String(req.body?.job_id || "").trim();

    if (!resumeId || !jobId) {
      return res.status(400).json({ message: "resume_id and job_id are required" });
    }

    if (isCandidateRole(req)) {
      const resume = await getResumeByPublicId(resumeId);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (!isOwnedByActor(resume, req)) {
        return res.status(403).json({ message: "You can only use your own resume" });
      }
    }

    const configuredLanguage = await getLanguageConfig().catch(() => null);
    const outputLanguage = resolveOutputLanguage(
      req.body?.output_language,
      configuredLanguage?.content_language
    );

    const result = await previewResumeImprovement(resumeId, jobId, outputLanguage);
    if (!result) {
      return res.status(404).json({ message: "Resume or job description not found" });
    }

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function confirmImproveResumeHandler(req, res, next) {
  try {
    await assertAiGenerationAllowed("resume_tailor_confirm");

    const resumeId = String(req.body?.resume_id || "").trim();
    const jobId = String(req.body?.job_id || "").trim();
    const improvedData = req.body?.improved_data;
    const improvements = Array.isArray(req.body?.improvements) ? req.body.improvements : [];

    if (!resumeId || !jobId || !improvedData || typeof improvedData !== "object") {
      return res.status(400).json({ message: "resume_id, job_id and improved_data are required" });
    }

    if (isCandidateRole(req)) {
      const resume = await getResumeByPublicId(resumeId);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (!isOwnedByActor(resume, req)) {
        return res.status(403).json({ message: "You can only use your own resume" });
      }
    }

    const configuredLanguage = await getLanguageConfig().catch(() => null);
    const outputLanguage = resolveOutputLanguage(
      req.body?.output_language,
      configuredLanguage?.content_language
    );

    const result = await confirmResumeImprovement({
      resumeId,
      jobId,
      improvedData,
      improvements,
      outputLanguage,
    });

    if (!result) {
      return res.status(404).json({ message: "Resume or job description not found" });
    }

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function improveResumeHandler(req, res, next) {
  try {
    await assertAiGenerationAllowed("resume_tailor");

    const resumeId = String(req.body?.resume_id || "").trim();
    const jobId = String(req.body?.job_id || "").trim();

    if (!resumeId || !jobId) {
      return res.status(400).json({ message: "resume_id and job_id are required" });
    }

    if (isCandidateRole(req)) {
      const resume = await getResumeByPublicId(resumeId);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (!isOwnedByActor(resume, req)) {
        return res.status(403).json({ message: "You can only use your own resume" });
      }
    }

    const configuredLanguage = await getLanguageConfig().catch(() => null);
    const outputLanguage = resolveOutputLanguage(
      req.body?.output_language,
      configuredLanguage?.content_language
    );

    const result = await improveResume(resumeId, jobId, outputLanguage);
    if (!result) {
      return res.status(404).json({ message: "Resume or job description not found" });
    }

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function updateCoverLetterHandler(req, res, next) {
  try {
    if (isCandidateRole(req)) {
      const resume = await getResumeByPublicId(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (!isOwnedByActor(resume, req)) {
        return res.status(403).json({ message: "You can only update your own resume" });
      }
    }

    const content = typeof req.body?.content === "string" ? req.body.content : "";
    const updated = await updateResumeFields(req.params.id, { coverLetter: content });
    if (!updated) {
      return res.status(404).json({ message: "Resume not found" });
    }

    return res.status(200).json({ message: "Cover letter updated successfully" });
  } catch (error) {
    return next(error);
  }
}

export async function updateOutreachMessageHandler(req, res, next) {
  try {
    if (isCandidateRole(req)) {
      const resume = await getResumeByPublicId(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (!isOwnedByActor(resume, req)) {
        return res.status(403).json({ message: "You can only update your own resume" });
      }
    }

    const content = typeof req.body?.content === "string" ? req.body.content : "";
    const updated = await updateResumeFields(req.params.id, { outreachMessage: content });
    if (!updated) {
      return res.status(404).json({ message: "Resume not found" });
    }

    return res.status(200).json({ message: "Outreach message updated successfully" });
  } catch (error) {
    return next(error);
  }
}

export async function updateResumeTitleHandler(req, res, next) {
  try {
    if (isCandidateRole(req)) {
      const resume = await getResumeByPublicId(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (!isOwnedByActor(resume, req)) {
        return res.status(403).json({ message: "You can only update your own resume" });
      }
    }

    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title) {
      return res.status(400).json({ message: "title is required" });
    }

    const updated = await updateResumeFields(req.params.id, { title });
    if (!updated) {
      return res.status(404).json({ message: "Resume not found" });
    }

    return res.status(200).json({ message: "Resume renamed successfully" });
  } catch (error) {
    return next(error);
  }
}

export async function getResumeJobDescriptionHandler(req, res, next) {
  try {
    const resume = await getResumeByPublicId(req.params.id);
    if (!resume) {
      return res.status(404).json({ message: "Resume not found" });
    }

    if (isCandidateRole(req) && !isOwnedByActor(resume, req)) {
      return res.status(403).json({ message: "You can only access your own resume" });
    }

    if (!resume.parentResumeId) {
      return res.status(400).json({ message: "Job description is only available for tailored resumes." });
    }

    if (!resume.jobDescription) {
      return res.status(404).json({ message: "No job description found for this resume." });
    }

    return res.status(200).json({
      job_id: resume.jobId || "",
      content: resume.jobDescription,
    });
  } catch (error) {
    return next(error);
  }
}

export async function generateCoverLetterHandler(req, res, next) {
  try {
    await assertAiGenerationAllowed("cover_letter_generation");

    if (isCandidateRole(req)) {
      const resume = await getResumeByPublicId(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (!isOwnedByActor(resume, req)) {
        return res.status(403).json({ message: "You can only use your own resume" });
      }
    }

    const configuredLanguage = await getLanguageConfig().catch(() => null);
    const outputLanguage = resolveOutputLanguage(
      req.body?.output_language,
      configuredLanguage?.content_language
    );
    const content = await generateCoverLetterContent(req.params.id, outputLanguage);
    if (!content) {
      return res.status(404).json({ message: "Resume not found" });
    }

    return res.status(200).json({
      content,
      message: "Cover letter generated successfully",
    });
  } catch (error) {
    return next(error);
  }
}

export async function downloadResumePdfHandler(req, res, next) {
  try {
    if (isCandidateRole(req)) {
      const resume = await getResumeByPublicId(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (!isOwnedByActor(resume, req)) {
        return res.status(403).json({ message: "You can only access your own resume" });
      }
    }

    const result = await generateResumePdf(req.params.id);
    if (!result) {
      return res.status(404).json({ message: "Resume not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"${result.filename}\"`);
    return res.status(200).send(result.buffer);
  } catch (error) {
    return next(error);
  }
}

export async function downloadCoverLetterPdfHandler(req, res, next) {
  try {
    if (isCandidateRole(req)) {
      const resume = await getResumeByPublicId(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (!isOwnedByActor(resume, req)) {
        return res.status(403).json({ message: "You can only access your own resume" });
      }
    }

    const result = await generateCoverLetterPdf(req.params.id);
    if (!result) {
      return res.status(404).json({ message: "Resume not found" });
    }

    if (!result.buffer) {
      return res.status(404).json({ message: "No cover letter available for this resume" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"${result.filename}\"`);
    return res.status(200).send(result.buffer);
  } catch (error) {
    return next(error);
  }
}

export async function downloadOriginalResumeHandler(req, res, next) {
  try {
    if (isCandidateRole(req)) {
      const resume = await getResumeByPublicId(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (!isOwnedByActor(resume, req)) {
        return res.status(403).json({ message: "You can only access your own resume" });
      }
    }

    const result = await downloadOriginalResumeFile(req.params.id);
    if (!result) {
      return res.status(404).json({ message: "Resume not found" });
    }

    if (!result.buffer) {
      return res.status(404).json({ message: "No original resume file available" });
    }

    res.setHeader("Content-Type", result.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return res.status(200).send(result.buffer);
  } catch (error) {
    return next(error);
  }
}

export async function generateOutreachHandler(req, res, next) {
  try {
    await assertAiGenerationAllowed("outreach_generation");

    if (isCandidateRole(req)) {
      const resume = await getResumeByPublicId(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (!isOwnedByActor(resume, req)) {
        return res.status(403).json({ message: "You can only use your own resume" });
      }
    }

    const configuredLanguage = await getLanguageConfig().catch(() => null);
    const outputLanguage = resolveOutputLanguage(
      req.body?.output_language,
      configuredLanguage?.content_language
    );
    const content = await generateOutreachContent(req.params.id, outputLanguage);
    if (!content) {
      return res.status(404).json({ message: "Resume not found" });
    }

    return res.status(200).json({
      content,
      message: "Outreach message generated successfully",
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteResumeHandler(req, res, next) {
  try {
    if (isCandidateRole(req)) {
      const resume = await getResumeByPublicId(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (!isOwnedByActor(resume, req)) {
        return res.status(403).json({ message: "You can only delete your own resume" });
      }
    }

    const deleted = await deleteResumeById(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Resume not found" });
    }

    return res.status(200).json({ message: "Resume deleted", id: String(deleted._id) });
  } catch (error) {
    return next(error);
  }
}
