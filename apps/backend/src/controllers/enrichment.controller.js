import {
  analyzeResumeEnrichment,
  applyRegeneratedResumeItems,
  applyResumeEnhancements,
  enhanceResumeDescriptions,
  regenerateResumeItems,
} from "../services/enrichment.service.js";
import { assertAiGenerationAllowed, getLanguageConfig } from "../services/config.service.js";
import { getResumeByPublicId } from "../services/resume.service.js";

const SUPPORTED_OUTPUT_LANGUAGES = new Set(["en", "vi", "auto"]);

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

function getAuthRole(req) {
  return String(req.auth?.role || "").trim().toLowerCase();
}

function getAuthUserId(req) {
  return String(req.auth?.userId || "").trim();
}

async function ensureResumeAccess(req, resumeId) {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

  if (getAuthRole(req) === "candidate" && String(resume.candidateId || "") !== getAuthUserId(req)) {
    const error = new Error("You can only enrich your own resume");
    error.statusCode = 403;
    error.error_code = "resume_forbidden";
    throw error;
  }

  return resume;
}

export async function analyzeResumeHandler(req, res, next) {
  try {
    await assertAiGenerationAllowed("enrichment_analyze");

    const configuredLanguage = await getLanguageConfig().catch(() => null);
    const outputLanguage = resolveOutputLanguage(
      req.body?.output_language,
      configuredLanguage?.content_language
    );

    const resume = await ensureResumeAccess(req, req.params.resumeId);
    if (!resume) {
      return res.status(404).json({ detail: "Resume not found" });
    }

    const result = await analyzeResumeEnrichment(req.params.resumeId, outputLanguage);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function enhanceResumeHandler(req, res, next) {
  try {
    await assertAiGenerationAllowed("enrichment_enhance");

    const resumeId = String(req.body?.resume_id || "").trim();
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];

    if (!resumeId) {
      return res.status(400).json({ detail: "resume_id is required" });
    }

    const configuredLanguage = await getLanguageConfig().catch(() => null);
    const outputLanguage = resolveOutputLanguage(
      req.body?.output_language,
      configuredLanguage?.content_language
    );

    const resume = await ensureResumeAccess(req, resumeId);
    if (!resume) {
      return res.status(404).json({ detail: "Resume not found" });
    }

    const result = await enhanceResumeDescriptions({ resumeId, answers, outputLanguage });
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function applyEnhancementsHandler(req, res, next) {
  try {
    const enhancements = Array.isArray(req.body?.enhancements) ? req.body.enhancements : [];
    const resume = await ensureResumeAccess(req, req.params.resumeId);
    if (!resume) {
      return res.status(404).json({ detail: "Resume not found" });
    }

    const result = await applyResumeEnhancements(req.params.resumeId, enhancements);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function regenerateItemsHandler(req, res, next) {
  try {
    await assertAiGenerationAllowed("enrichment_regenerate");

    const payload = {
      resumeId: String(req.body?.resume_id || "").trim(),
      items: Array.isArray(req.body?.items) ? req.body.items : [],
      instruction: String(req.body?.instruction || "").trim(),
    };

    const configuredLanguage = await getLanguageConfig().catch(() => null);
    const outputLanguage = resolveOutputLanguage(
      req.body?.output_language,
      configuredLanguage?.content_language
    );

    if (!payload.resumeId) {
      return res.status(400).json({ detail: "resume_id is required" });
    }

    if (!payload.items.length) {
      return res.status(400).json({ detail: "No items selected for regeneration" });
    }

    const resume = await ensureResumeAccess(req, payload.resumeId);
    if (!resume) {
      return res.status(404).json({ detail: "Resume not found" });
    }

    const result = await regenerateResumeItems({ ...payload, outputLanguage });
    if (!result.regenerated_items.length) {
      return res.status(500).json({ detail: "Failed to regenerate content. Please try again." });
    }

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function applyRegeneratedItemsHandler(req, res, next) {
  try {
    const items = Array.isArray(req.body) ? req.body : [];
    const resume = await ensureResumeAccess(req, req.params.resumeId);
    if (!resume) {
      return res.status(404).json({ detail: "Resume not found" });
    }

    const result = await applyRegeneratedResumeItems(req.params.resumeId, items);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}
