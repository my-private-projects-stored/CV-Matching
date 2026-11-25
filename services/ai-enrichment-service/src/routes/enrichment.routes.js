import express from "express";
import { ROLES } from "@cvm/shared";
import { requireAuth, requireRole } from "../middleware/auth-context.js";

function tokenizeKeywords(text = "") {
  return Array.from(
    new Set(
      String(text || "")
        .toLowerCase()
        .split(/[^a-z0-9.+#-]+/i)
        .map((s) => s.trim())
        .filter((s) => s.length >= 3)
    )
  );
}

function buildJdMatchPayload(resumeId, body = {}, fallbackResult = {}) {
  const jdText = String(body.job_description || body.jobDescription || "");
  const resumeText = String(body.resumeText || body.resume_text || "");
  const jdTokens = tokenizeKeywords(jdText).slice(0, 25);
  const resumeSet = new Set(tokenizeKeywords(resumeText));
  const matched = [];
  const missing = [];
  for (const tk of jdTokens) {
    if (resumeSet.has(tk)) matched.push(tk);
    else missing.push(tk);
  }
  const keywordScore = jdTokens.length > 0 ? Number((matched.length / jdTokens.length).toFixed(4)) : 0.65;
  const pct = Math.round(keywordScore * 100);
  const recs = fallbackResult?.optimization?.bullet_suggestions || [
    "Highlight measurable outcomes aligned with the job description.",
  ];
  return {
    match_percentage: pct,
    keyword_score: keywordScore,
    semantic_score: null,
    hybrid_score: null,
    score_method: "keyword_only",
    score_weights: { semantic: 0.65, keyword: 0.35 },
    matched_keywords: matched,
    missing_keywords: missing.length ? missing : fallbackResult?.optimization?.missing_keywords || [],
    jd_highlights: jdTokens.slice(0, 8).map((t) => ({ text: t, type: "skill" })),
    resume_highlights: matched.slice(0, 8).map((t) => ({ text: t, type: "matched" })),
    recommendations: recs,
    resume_id: resumeId,
  };
}

export function createEnrichmentRoutes(enrichmentService) {
  const router = express.Router();

  router.post("/optimize-cv", requireAuth, async (req, res, next) => {
    try {
      const result = await enrichmentService.optimizeCvForJob({
        viewer: req.auth,
        payload: req.body || {},
        requestId: req.requestId || "",
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/cover-letter", requireAuth, async (req, res, next) => {
    try {
      const result = await enrichmentService.generateCoverLetter({
        viewer: req.auth,
        payload: req.body || {},
        requestId: req.requestId || "",
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/outreach", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const result = await enrichmentService.generateOutreach({
        viewer: req.auth,
        payload: req.body || {},
        requestId: req.requestId || "",
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/analyze/:resumeId", requireAuth, async (req, res) => {
    const itemId = `exp-${req.params.resumeId}-1`;
    res.json({
      items_to_enrich: [
        {
          item_id: itemId,
          item_type: "experience",
          title: "Core Professional Experience",
          subtitle: "Quantifiable impact & technical depth",
          current_description: ["Built and maintained production services."],
          weakness_reason: "Add measurable metrics (latency, throughput, or business impact).",
        },
      ],
      questions: [
        {
          question_id: `q-${req.params.resumeId}-1`,
          item_id: itemId,
          question: "What measurable performance or delivery outcome did you achieve in this role?",
          placeholder: "e.g., Reduced API P95 latency by 40% across 5,000 daily requests",
        },
      ],
      analysis_summary: "Identified 1 experience section that can be strengthened with measurable impact.",
    });
  });

  router.post("/enhance", requireAuth, async (req, res) => {
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const enhancements = answers.map((ans, idx) => ({
      item_id: `exp-${idx + 1}`,
      item_type: "experience",
      title: "Enhanced Experience Bullet",
      original_description: ["Built and maintained production services."],
      enhanced_description: [String(ans?.answer || "Delivered measurable engineering improvements.")],
    }));
    res.json({ enhancements });
  });

  router.post("/apply/:resumeId", requireAuth, async (req, res) => {
    const enhancements = Array.isArray(req.body?.enhancements) ? req.body.enhancements : [];
    res.json({ message: "Enhancements applied", updated_items: enhancements.length });
  });

  router.post("/regenerate", requireAuth, async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const instruction = String(req.body?.instruction || "Improve clarity and impact");
    const regeneratedItems = items.map((item) => ({
      item_id: item.item_id,
      item_type: item.item_type,
      title: item.title,
      subtitle: item.subtitle || "",
      original_content: Array.isArray(item.current_content) ? item.current_content : [],
      new_content: (Array.isArray(item.current_content) ? item.current_content : []).map(
        (line) => `${line} (${instruction})`
      ),
      diff_summary: `Refined with instruction: ${instruction}`,
    }));
    res.json({ regenerated_items: regeneratedItems, errors: [] });
  });

  router.post("/apply-regenerated/:resumeId", requireAuth, async (req, res) => {
    const items = Array.isArray(req.body) ? req.body : [];
    res.json({ message: "Regenerated items applied", updated_items: items.length });
  });

  return router;
}

/**
 * Legacy Strangler Fig aliases under /api/resumes/* for LLM enrichment sub-routes.
 */
export function createLegacyResumeEnrichmentRoutes(enrichmentService) {
  const router = express.Router();

  router.post("/improve", requireAuth, async (req, res, next) => {
    try {
      const result = await enrichmentService.optimizeCvForJob({
        viewer: req.auth,
        payload: req.body || {},
        requestId: req.requestId || "",
      });
      res.json({
        ...result,
        resume_id: req.body?.resume_id || req.body?.resumeId || "",
        job_id: req.body?.job_id || req.body?.jobId || "",
        improvements: (result.optimization?.bullet_suggestions || []).map((s, idx) => ({
          suggestion: s,
          lineNumber: idx + 1,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/improve/preview", requireAuth, async (req, res, next) => {
    try {
      const result = await enrichmentService.optimizeCvForJob({
        viewer: req.auth,
        payload: req.body || {},
        requestId: req.requestId || "",
      });
      res.json({
        ...result,
        resume_id: req.body?.resume_id || req.body?.resumeId || "",
        job_id: req.body?.job_id || req.body?.jobId || "",
        improvements: (result.optimization?.bullet_suggestions || []).map((s, idx) => ({
          suggestion: s,
          lineNumber: idx + 1,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/improve/confirm", requireAuth, async (req, res) => {
    res.json({
      resume_id: req.body?.resume_id || "",
      job_id: req.body?.job_id || "",
      improved_data: req.body?.improved_data || {},
      improvements: req.body?.improvements || [],
      generation_mode: req.body?.generation_mode || "template_fallback",
    });
  });

  router.post("/:id/jd-match", requireAuth, async (req, res, next) => {
    try {
      const result = await enrichmentService.optimizeCvForJob({
        viewer: req.auth,
        payload: { ...(req.body || {}), resumeId: req.params.id },
        requestId: req.requestId || "",
      });
      res.json({
        request_id: req.requestId || "",
        ...result,
        data: buildJdMatchPayload(req.params.id, req.body, result),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/generate-cover-letter", requireAuth, async (req, res, next) => {
    try {
      const result = await enrichmentService.generateCoverLetter({
        viewer: req.auth,
        payload: { ...(req.body || {}), resumeId: req.params.id },
        requestId: req.requestId || "",
      });
      res.json({
        ...result,
        content: result.cover_letter?.content || result.coverLetter?.content || "",
      });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/:id/generate-outreach",
    requireAuth,
    requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF),
    async (req, res, next) => {
      try {
        const result = await enrichmentService.generateOutreach({
          viewer: req.auth,
          payload: { ...(req.body || {}), resumeId: req.params.id },
          requestId: req.requestId || "",
        });
        res.json({
          ...result,
          content: result.outreach?.message || result.outreach?.body || result.outreach?.subject || "",
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
