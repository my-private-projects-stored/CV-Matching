import express from "express";
import { ROLES } from "@cvm/shared";
import { requireAuth, requireRole } from "../middleware/auth-context.js";

function getLastHistoryEntry(app) {
  const hist = Array.isArray(app?.statusHistory) ? app.statusHistory : [];
  if (hist.length === 0) return null;
  const last = hist[hist.length - 1];
  return {
    from_status: last.fromStatus ?? null,
    to_status: last.toStatus,
    changed_at: last.changedAt,
    changed_by: last.changedBy,
  };
}

function formatCandidateHistoryItem(app) {
  return {
    application_id: String(app._id),
    candidate_id: app.candidateId ? String(app.candidateId) : null,
    status: app.status,
    ai_status: app.aiStatus || "pending",
    __v: Number(app.__v || 0),
    job: {
      id: app.jobId ? String(app.jobId) : null,
      title: app.jobTitle || `Job #${String(app.jobId || "").slice(-6)}`,
      status: "active",
      location: app.jobLocation || null,
      category: app.jobCategory || null,
    },
    resume: {
      id: app.resumeId ? String(app.resumeId) : null,
      title: app.resumeTitle || `CV #${String(app.resumeId || "").slice(-6)}`,
      processing_status: "ready",
    },
    scores: {
      hybrid_score: Number(app.aiScores?.hybridScore ?? 0),
    },
    submitted_at: app.createdAt,
    updated_at: app.updatedAt,
    status_audit: getLastHistoryEntry(app),
  };
}

function formatRankedCandidateItem(app) {
  return {
    application_id: String(app._id),
    status: app.status,
    ai_status: app.aiStatus || "pending",
    __v: Number(app.__v || 0),
    candidate: {
      id: app.candidateId ? String(app.candidateId) : null,
      full_name: app.candidateName || `Candidate ${String(app.candidateId || "").slice(-6)}`,
      email: app.candidateEmail || "",
    },
    resume: {
      id: app.resumeId ? String(app.resumeId) : null,
      title: app.resumeTitle || `CV #${String(app.resumeId || "").slice(-6)}`,
      processing_status: "ready",
    },
    scores: {
      semantic_score: Number(app.aiScores?.semanticScore ?? 0),
      keyword_score: Number(app.aiScores?.keywordScore ?? 0),
      hybrid_score: Number(app.aiScores?.hybridScore ?? 0),
    },
    explainability: {
      matched_keywords: app.aiDetails?.matchedKeywords || [],
      missing_keywords: app.aiDetails?.missingKeywords || [],
    },
    updated_at: app.updatedAt,
    status_audit: getLastHistoryEntry(app),
  };
}

export function createApplicationRoutes(applicationService) {
  const router = express.Router();

  router.post("/", requireAuth, requireRole(ROLES.CANDIDATE, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const result = await applicationService.submitApplication({
        candidateId: req.auth.id,
        payload: req.body || {},
      });
      res.status(201).json({
        ...result,
        request_id: req.requestId || "",
        data: {
          application_id: result.application_id,
          status: result.status,
          ai_status: result.ai_status,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/ranked", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const result = await applicationService.listRankedByJob({
        jobId: req.query?.job_id || req.query?.jobId,
        status: req.query?.status,
        aiStatus: req.query?.ai_status || req.query?.aiStatus,
        minScore: req.query?.min_score,
        maxScore: req.query?.max_score,
        page: req.query?.page,
        limit: req.query?.limit,
      });
      let candidates = (result.applications || []).map(formatRankedCandidateItem);
      const search = String(req.query?.search || "").trim().toLowerCase();
      if (search) {
        candidates = candidates.filter((c) =>
          [c.candidate?.full_name, c.candidate?.email, c.resume?.title, c.status]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(search))
        );
      }
      const total = search ? candidates.length : Number(result.pagination?.total ?? 0);
      const limit = Number(result.pagination?.limit ?? 20);
      res.json({
        request_id: req.requestId || "",
        ...result,
        data: {
          job: {
            id: String(req.query?.job_id || req.query?.jobId || ""),
            title: "",
            status: "active",
          },
          candidates,
          pagination: {
            page: Number(result.pagination?.page ?? 1),
            limit,
            total,
            total_pages: Math.max(1, Math.ceil(total / limit)),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/history", requireAuth, async (req, res, next) => {
    try {
      const targetCandidateId =
        req.query?.candidate_id && req.auth.role !== ROLES.CANDIDATE
          ? String(req.query.candidate_id)
          : req.auth.id;
      const applications = await applicationService.listCandidateHistory({
        candidateId: targetCandidateId,
        status: req.query?.status || null,
        aiStatus: req.query?.ai_status || req.query?.aiStatus || null,
        submittedAfter: req.query?.submitted_after || null,
        submittedBefore: req.query?.submitted_before || null,
      });
      let formatted = applications.map(formatCandidateHistoryItem);
      const search = String(req.query?.search || "").trim().toLowerCase();
      if (search) {
        formatted = formatted.filter((item) =>
          [item.job?.title, item.resume?.title, item.job?.location, item.status]
            .filter(Boolean)
            .some((val) => String(val).toLowerCase().includes(search))
        );
      }
      const page = Math.max(1, Number.parseInt(String(req.query?.page || "1"), 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query?.limit || "50"), 10) || 50));
      const total = formatted.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const paged = formatted.slice((page - 1) * limit, page * limit);

      res.json({
        request_id: req.requestId || "",
        applications,
        data: {
          candidate_id: targetCandidateId,
          applications: paged,
          pagination: {
            page,
            limit,
            total,
            total_pages: totalPages,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/summary", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const jobId = String(req.query?.job_id || req.query?.jobId || "");
      const result = await applicationService.listRankedByJob({ jobId, page: 1, limit: 500 });
      const apps = result.applications || [];
      const byStatus = { draft: 0, new: 0, screening: 0, interview: 0, offer: 0, hired: 0, rejected: 0, withdrawn: 0 };
      const byAiStatus = { pending: 0, parsing: 0, scoring: 0, completed: 0, failed: 0 };
      for (const a of apps) {
        if (byStatus[a.status] !== undefined) byStatus[a.status] += 1;
        if (byAiStatus[a.aiStatus] !== undefined) byAiStatus[a.aiStatus] += 1;
      }
      res.json({
        request_id: req.requestId || "",
        data: {
          job: { id: jobId, title: "" },
          total: apps.length,
          by_status: byStatus,
          by_ai_status: byAiStatus,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/status-changes", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const jobId = String(req.query?.job_id || req.query?.jobId || "");
      const result = await applicationService.listRankedByJob({ jobId, page: 1, limit: 100 });
      const changes = (result.applications || []).map((app) => {
        const last = getLastHistoryEntry(app);
        return {
          application_id: String(app._id),
          job: { id: app.jobId || jobId, title: "" },
          candidate: { id: app.candidateId || null, full_name: "", email: "" },
          from_status: last?.from_status ?? null,
          to_status: last?.to_status ?? app.status,
          changed_at: last?.changed_at ?? app.updatedAt,
          changed_by: last?.changed_by ?? "",
          current_status: app.status,
        };
      });
      res.json({
        request_id: req.requestId || "",
        data: {
          job: { id: jobId, title: "" },
          changes,
          pagination: { page: 1, limit: 100, total: changes.length, total_pages: 1 },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/status-changes/export", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const jobId = String(req.query?.job_id || req.query?.jobId || "");
      const result = await applicationService.listRankedByJob({ jobId, page: 1, limit: 500 });
      const header = "application_id,job_id,candidate_id,from_status,to_status,changed_at,changed_by,current_status";
      const rows = (result.applications || []).map((app) => {
        const last = getLastHistoryEntry(app);
        return [
          String(app._id),
          app.jobId || jobId,
          app.candidateId || "",
          last?.from_status || "",
          last?.to_status || app.status,
          last?.changed_at ? new Date(last.changed_at).toISOString() : "",
          last?.changed_by || "",
          app.status,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",");
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="status-changes.csv"');
      res.send([header, ...rows].join("\n"));
    } catch (error) {
      next(error);
    }
  });

  async function handleBulkStatus(req, res, next) {
    try {
      const applicationIds = req.body?.application_ids || req.body?.applicationIds || [];
      const targetStatus = req.body?.status || req.body?.to_status;
      const result = await applicationService.bulkUpdateStatus({
        applicationIds,
        toStatus: targetStatus,
        viewer: req.auth,
        reason: req.body?.reason,
      });
      res.json({
        request_id: req.requestId || "",
        ...result,
        data: {
          requested_count: applicationIds.length,
          matched_count: Number(result.updatedCount || 0) + Number(result.skippedCount || 0),
          updated_count: Number(result.updatedCount || 0),
          unchanged_count: Number(result.skippedCount || 0),
          updated_ids: [],
          status: targetStatus,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  router.post("/bulk-status", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), handleBulkStatus);
  router.patch("/status/bulk", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), handleBulkStatus);

  router.post("/:id/withdraw", requireAuth, requireRole(ROLES.CANDIDATE, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const application = await applicationService.withdrawApplication({
        applicationId: req.params.id,
        candidateId: req.auth.id,
        expectedVersion: req.body?.__v ?? req.body?.version,
        reason: req.body?.reason,
      });
      res.json({ request_id: req.requestId || "", application });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/retry-scoring", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const application = await applicationService.triggerScoringRetry({
        applicationId: req.params.id,
        viewer: req.auth,
      });
      res.json({ request_id: req.requestId || "", application });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/status", requireAuth, requireRole(ROLES.RECRUITER, ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const application = await applicationService.updateApplicationStatus({
        applicationId: req.params.id,
        viewer: req.auth,
        toStatus: req.body?.status || req.body?.to_status,
        expectedVersion: req.body?.__v ?? req.body?.version,
        action: req.body?.action || null,
        reason: req.body?.reason,
      });
      res.json({
        request_id: req.requestId || "",
        application,
        data: {
          application_id: String(application._id),
          status: application.status,
          __v: Number(application.__v || 0),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/feedback", requireAuth, async (req, res, next) => {
    try {
      const feedback = await applicationService.getApplicationFeedback({
        applicationId: req.params.id,
        viewer: req.auth,
      });
      const missingKeywords = feedback.explainability?.missingKeywords || [];
      res.json({
        request_id: req.requestId || "",
        ...feedback,
        data: {
          application_id: feedback.application_id,
          job_id: feedback.job_id || null,
          resume_id: feedback.resume_id || null,
          scores: {
            semantic_score: Number(feedback.scores?.semanticScore ?? 0),
            keyword_score: Number(feedback.scores?.keywordScore ?? 0),
            hybrid_score: Number(feedback.scores?.hybridScore ?? 0),
          },
          explainability: {
            matched_keywords: feedback.explainability?.matchedKeywords || [],
            missing_keywords: missingKeywords,
          },
          recommendations: missingKeywords
            .slice(0, 5)
            .map((kw) => `Add concrete evidence or project metrics demonstrating '${kw}'.`),
          status: feedback.status || "new",
          ai_status: feedback.ai_status,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/status-history", requireAuth, async (req, res, next) => {
    try {
      const history = await applicationService.getStatusHistory({
        applicationId: req.params.id,
        viewer: req.auth,
      });
      res.json({
        request_id: req.requestId || "",
        ...history,
        data: {
          application_id: history.application_id,
          current_status: history.current_status,
          history: (history.status_history || []).map((h) => ({
            from_status: h.fromStatus ?? null,
            to_status: h.toStatus,
            changed_at: h.changedAt,
            changed_by: h.changedBy,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", requireAuth, async (req, res, next) => {
    try {
      const application = await applicationService.getApplicationById({
        applicationId: req.params.id,
        viewer: req.auth,
      });
      res.json({ request_id: req.requestId || "", application, data: formatCandidateHistoryItem(application) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
