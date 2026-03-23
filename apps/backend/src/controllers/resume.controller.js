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
  improveResume,
  listResumeSummaries,
  previewResumeImprovement,
  retryResumeProcessing,
  setResumeAsMaster,
  toResumeFetchData,
  toResumeSummary,
  updateResumeById,
  updateResumeFields,
} from "../services/resume.service.js";
import { getLanguageConfig } from "../services/config.service.js";

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
    const result = await createResumeFromUpload(req.file);
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
    const data = await listResumeSummaries(includeMaster);

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
    const candidateId = String(req.query.candidate_id || "").trim();
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

export async function setMasterResumeHandler(req, res, next) {
  try {
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

export async function createResumeHandler(req, res, next) {
  try {
    const created = await createResume(req.body);
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
    const resumeId = String(req.body?.resume_id || "").trim();
    const jobId = String(req.body?.job_id || "").trim();

    if (!resumeId || !jobId) {
      return res.status(400).json({ message: "resume_id and job_id are required" });
    }

    const result = await previewResumeImprovement(resumeId, jobId);
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
    const resumeId = String(req.body?.resume_id || "").trim();
    const jobId = String(req.body?.job_id || "").trim();
    const improvedData = req.body?.improved_data;
    const improvements = Array.isArray(req.body?.improvements) ? req.body.improvements : [];

    if (!resumeId || !jobId || !improvedData || typeof improvedData !== "object") {
      return res.status(400).json({ message: "resume_id, job_id and improved_data are required" });
    }

    const result = await confirmResumeImprovement({
      resumeId,
      jobId,
      improvedData,
      improvements,
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
    const resumeId = String(req.body?.resume_id || "").trim();
    const jobId = String(req.body?.job_id || "").trim();

    if (!resumeId || !jobId) {
      return res.status(400).json({ message: "resume_id and job_id are required" });
    }

    const result = await improveResume(resumeId, jobId);
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
    const deleted = await deleteResumeById(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Resume not found" });
    }

    return res.status(200).json({ message: "Resume deleted", id: String(deleted._id) });
  } catch (error) {
    return next(error);
  }
}
