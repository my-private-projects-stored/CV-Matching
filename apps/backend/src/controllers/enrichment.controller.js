import {
  analyzeResumeEnrichment,
  applyRegeneratedResumeItems,
  applyResumeEnhancements,
  enhanceResumeDescriptions,
  regenerateResumeItems,
} from "../services/enrichment.service.js";

export async function analyzeResumeHandler(req, res, next) {
  try {
    const result = await analyzeResumeEnrichment(req.params.resumeId);
    if (!result) {
      return res.status(404).json({ detail: "Resume not found" });
    }

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function enhanceResumeHandler(req, res, next) {
  try {
    const resumeId = String(req.body?.resume_id || "").trim();
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];

    if (!resumeId) {
      return res.status(400).json({ detail: "resume_id is required" });
    }

    const result = await enhanceResumeDescriptions({ resumeId, answers });
    if (!result) {
      return res.status(404).json({ detail: "Resume not found" });
    }

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function applyEnhancementsHandler(req, res, next) {
  try {
    const enhancements = Array.isArray(req.body?.enhancements) ? req.body.enhancements : [];
    const result = await applyResumeEnhancements(req.params.resumeId, enhancements);

    if (!result) {
      return res.status(404).json({ detail: "Resume not found" });
    }

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function regenerateItemsHandler(req, res, next) {
  try {
    const payload = {
      resumeId: String(req.body?.resume_id || "").trim(),
      items: Array.isArray(req.body?.items) ? req.body.items : [],
      instruction: String(req.body?.instruction || "").trim(),
    };

    if (!payload.resumeId) {
      return res.status(400).json({ detail: "resume_id is required" });
    }

    if (!payload.items.length) {
      return res.status(400).json({ detail: "No items selected for regeneration" });
    }

    const result = await regenerateResumeItems(payload);
    if (!result) {
      return res.status(404).json({ detail: "Resume not found" });
    }

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
    const result = await applyRegeneratedResumeItems(req.params.resumeId, items);

    if (!result) {
      return res.status(404).json({ detail: "Resume not found" });
    }

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}
