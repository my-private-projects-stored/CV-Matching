import mongoose from "mongoose";
import { PUBSUB_CHANNELS, ROLES, createHttpError, hasAnyRole } from "@cvm/shared";
import { HYBRID_SEMANTIC_WEIGHT, computeHybridScore } from "./scoring-engine.js";
import { canTriggerScoringRetry, validateStatusTransition } from "./state-machine.js";

function defaultRunInTransaction(fn) {
  return mongoose.startSession().then(async (session) => {
    try {
      let result;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  });
}

function normalizePagination(query = {}) {
  const page = Math.max(1, Number.parseInt(String(query.page || "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(query.limit || "20"), 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Application domain service: Transactional Outbox, OCC (__v), State Machine,
 * BulkWrite (<=500), and AI Scoring lifecycle.
 */
export function createApplicationService({
  ApplicationModel,
  OutboxEventModel,
  JobStatusMirrorModel,
  redisBus = null,
  runInTransaction = defaultRunInTransaction,
  scoringStep = null,
  resolveJobMetadata = null,
  resolveCandidateMetadata = null,
  resolveResumeMetadata = null,
  defaultSemanticWeight = HYBRID_SEMANTIC_WEIGHT,
} = {}) {
  async function createWithSession(Model, doc, session) {
    if (session && typeof session.inTransaction === "function") {
      const created = await Model.create([doc], { session });
      return Array.isArray(created) ? created[0] : created;
    }
    return Model.create(doc);
  }

  async function submitApplication({ candidateId, payload = {} }) {
    const jobId = String(payload.job_id || payload.jobId || "").trim();
    const resumeId = String(payload.resume_id || payload.resumeId || "").trim();
    const initialStatus = String(payload.status || "new").trim().toLowerCase();

    if (!jobId || !resumeId) {
      throw createHttpError(400, "job_id and resume_id are required", "missing_application_fields");
    }

    if (initialStatus !== "new" && initialStatus !== "draft") {
      throw createHttpError(400, "Initial application status must be 'new' or 'draft'", "invalid_initial_status");
    }

    let mirror = JobStatusMirrorModel ? await JobStatusMirrorModel.findOne({ jobId }) : null;
    if ((!mirror || !mirror.recruiterId) && typeof resolveJobMetadata === "function") {
      try {
        const remoteJob = await resolveJobMetadata(jobId);
        if (remoteJob) {
          if (remoteJob.status && remoteJob.status !== "active" && remoteJob.status !== "open") {
            throw createHttpError(
              400,
              `Job is currently '${remoteJob.status}' and not accepting applications`,
              "job_not_accepting_applications"
            );
          }
          if (JobStatusMirrorModel && typeof JobStatusMirrorModel.findOneAndUpdate === "function") {
            mirror = await JobStatusMirrorModel.findOneAndUpdate(
              { jobId },
              {
                $set: {
                  jobId,
                  status: String(remoteJob.status || "active").toLowerCase(),
                  recruiterId: String(remoteJob.recruiterId || ""),
                  title: String(remoteJob.title || ""),
                  category: String(remoteJob.category || ""),
                  syncedAt: new Date(),
                },
              },
              { upsert: true, new: true }
            );
          } else {
            mirror = {
              jobId,
              status: String(remoteJob.status || "active").toLowerCase(),
              recruiterId: String(remoteJob.recruiterId || ""),
            };
          }
        }
      } catch (err) {
        if (err?.statusCode === 400) throw err;
        // Best-effort lookup; remain resilient if job-service is down (Chaos 4)
      }
    }
    if (mirror && mirror.status !== "active" && mirror.status !== "open") {
      throw createHttpError(
        400,
        `Job is currently '${mirror.status}' and not accepting applications`,
        "job_not_accepting_applications"
      );
    }

    const duplicate = await ApplicationModel.findOne({
      jobId,
      resumeId,
      status: { $ne: "withdrawn" },
    });
    if (duplicate) {
      throw createHttpError(
        409,
        "An active application already exists for this job and resume",
        "duplicate_application"
      );
    }

    const [candidateMeta, resumeMeta] = await Promise.all([
      typeof resolveCandidateMetadata === "function"
        ? resolveCandidateMetadata(candidateId).catch(() => null)
        : Promise.resolve(null),
      typeof resolveResumeMetadata === "function"
        ? resolveResumeMetadata(resumeId).catch(() => null)
        : Promise.resolve(null),
    ]);

    const now = new Date();
    const { application, outboxEvent } = await runInTransaction(async (session) => {
      const appDoc = await createWithSession(
        ApplicationModel,
        {
          candidateId: String(candidateId),
          jobId,
          resumeId,
          recruiterId: mirror?.recruiterId || String(payload.recruiterId || ""),
          candidateName: String(candidateMeta?.fullName || payload.candidateName || payload.candidate_name || "").trim(),
          candidateEmail: String(candidateMeta?.email || payload.candidateEmail || payload.candidate_email || "").trim(),
          resumeTitle: String(resumeMeta?.title || payload.resumeTitle || payload.resume_title || "").trim(),
          status: initialStatus,
          aiStatus: "pending",
          aiScores: { semanticScore: 0, keywordScore: 0, hybridScore: 0 },
          aiDetails: { matchedKeywords: [], missingKeywords: [] },
          statusHistory: [
            {
              fromStatus: null,
              toStatus: initialStatus,
              changedAt: now,
              changedBy: String(candidateId),
              reason: initialStatus === "draft" ? "Saved as draft" : "Submitted application",
            },
          ],
        },
        session
      );

      let eventDoc = null;
      if (initialStatus === "new") {
        eventDoc = await createWithSession(
          OutboxEventModel,
          {
            eventType: "APPLICATION_SUBMITTED",
            aggregateId: String(appDoc._id),
            status: "pending",
            payload: {
              application_id: String(appDoc._id),
              job_id: jobId,
              resume_id: resumeId,
              candidate_id: String(candidateId),
              retry_count: 0,
              enqueued_at: now.toISOString(),
            },
          },
          session
        );
      }

      return { application: appDoc, outboxEvent: eventDoc };
    });

    return {
      application_id: String(application._id),
      job_id: application.jobId,
      resume_id: application.resumeId,
      candidate_id: application.candidateId,
      status: application.status,
      ai_status: application.aiStatus,
      __v: Number(application.__v || 0),
      outbox_event_id: outboxEvent ? String(outboxEvent._id) : null,
      application,
    };
  }

  async function applyAtomicTransition({
    application,
    toStatus,
    actorId,
    expectedVersion,
    reason = "",
    manualScreeningOverride = false,
  }) {
    const versionToMatch =
      expectedVersion !== undefined && expectedVersion !== null
        ? Number(expectedVersion)
        : Number(application.__v || 0);

    const now = new Date();
    const historyEntry = {
      fromStatus: application.status,
      toStatus,
      changedAt: now,
      changedBy: String(actorId),
      reason: String(reason || "").trim(),
    };

    const setFields = {
      status: toStatus,
      ...(toStatus === "withdrawn" ? { withdrawnAt: now } : {}),
      ...(manualScreeningOverride ? { manualScreeningOverride: true } : {}),
    };

    const updated = await runInTransaction(async (session) => {
      const doc = await ApplicationModel.findOneAndUpdate(
        { _id: application._id, __v: versionToMatch },
        {
          $set: setFields,
          $inc: { __v: 1 },
          $push: { statusHistory: historyEntry },
        },
        { new: true, ...(session ? { session } : {}) }
      );

      if (!doc) {
        throw createHttpError(
          409,
          "Application was modified concurrently. Please refresh and retry.",
          "optimistic_concurrency_conflict"
        );
      }

      await createWithSession(
        OutboxEventModel,
        {
          eventType: "APPLICATION_STATUS_CHANGED",
          aggregateId: String(doc._id),
          status: "pending",
          payload: {
            application_id: String(doc._id),
            job_id: doc.jobId,
            resume_id: doc.resumeId,
            candidate_id: doc.candidateId,
            from_status: application.status,
            to_status: toStatus,
            changed_by: String(actorId),
            changed_at: now.toISOString(),
          },
        },
        session
      );

      return doc;
    });

    return updated;
  }

  async function withdrawApplication({ applicationId, candidateId, expectedVersion, reason = "" }) {
    const app = await ApplicationModel.findById(applicationId);
    if (!app) {
      throw createHttpError(404, "Application not found", "application_not_found");
    }
    if (String(app.candidateId) !== String(candidateId)) {
      throw createHttpError(403, "Forbidden withdrawal", "forbidden_application_access");
    }

    const check = validateStatusTransition({
      currentStatus: app.status,
      nextStatus: "withdrawn",
      aiStatus: app.aiStatus,
    });
    if (!check.ok) {
      throw createHttpError(check.statusCode, check.message, check.errorCode);
    }

    return applyAtomicTransition({
      application: app,
      toStatus: "withdrawn",
      actorId: candidateId,
      expectedVersion,
      reason: reason || "Withdrawn by candidate",
    });
  }

  async function updateApplicationStatus({
    applicationId,
    viewer,
    toStatus,
    expectedVersion,
    action = null,
    reason = "",
  }) {
    const app = await ApplicationModel.findById(applicationId);
    if (!app) {
      throw createHttpError(404, "Application not found", "application_not_found");
    }

    const check = validateStatusTransition({
      currentStatus: app.status,
      nextStatus: toStatus,
      aiStatus: app.aiStatus,
      action,
    });
    if (!check.ok) {
      throw createHttpError(check.statusCode, check.message, check.errorCode);
    }

    return applyAtomicTransition({
      application: app,
      toStatus: String(toStatus).trim().toLowerCase(),
      actorId: viewer.id,
      expectedVersion,
      reason,
      manualScreeningOverride: check.manualScreeningOverride,
    });
  }

  async function triggerScoringRetry({ applicationId, viewer }) {
    const app = await ApplicationModel.findById(applicationId);
    if (!app) {
      throw createHttpError(404, "Application not found", "application_not_found");
    }

    if (!canTriggerScoringRetry({ currentStatus: app.status, aiStatus: app.aiStatus })) {
      throw createHttpError(
        409,
        "Scoring retry is only allowed when application is active and aiStatus is 'failed'",
        "scoring_retry_not_allowed"
      );
    }

    const now = new Date();
    return runInTransaction(async (session) => {
      const updated = await ApplicationModel.findOneAndUpdate(
        { _id: app._id, __v: Number(app.__v || 0) },
        {
          $set: { aiStatus: "pending", scoringError: "" },
          $inc: { __v: 1 },
        },
        { new: true, ...(session ? { session } : {}) }
      );

      if (!updated) {
        throw createHttpError(409, "Concurrent modification during retry trigger", "optimistic_concurrency_conflict");
      }

      await createWithSession(
        OutboxEventModel,
        {
          eventType: "APPLICATION_RETRY_SCORING",
          aggregateId: String(updated._id),
          status: "pending",
          payload: {
            application_id: String(updated._id),
            job_id: updated.jobId,
            resume_id: updated.resumeId,
            candidate_id: updated.candidateId,
            retry_count: 0,
            triggered_by: String(viewer.id),
            enqueued_at: now.toISOString(),
          },
        },
        session
      );

      return updated;
    });
  }

  async function bulkUpdateStatus({ applicationIds = [], toStatus, viewer, reason = "" }) {
    const startedAt = Date.now();
    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      throw createHttpError(400, "application_ids array is required", "empty_bulk_list");
    }
    if (applicationIds.length > 500) {
      throw createHttpError(400, "Maximum 500 applications per bulk update", "bulk_limit_exceeded");
    }

    const normalizedTarget = String(toStatus || "").trim().toLowerCase();
    const docs = await ApplicationModel.find({ _id: { $in: applicationIds.map(String) } });

    const bulkOps = [];
    const outboxDocs = [];
    const errors = [];
    const now = new Date();

    for (const app of docs) {
      const check = validateStatusTransition({
        currentStatus: app.status,
        nextStatus: normalizedTarget,
        aiStatus: app.aiStatus,
      });

      if (!check.ok) {
        errors.push({ application_id: String(app._id), error_code: check.errorCode, message: check.message });
        continue;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: app._id, __v: Number(app.__v || 0) },
          update: {
            $set: { status: normalizedTarget },
            $inc: { __v: 1 },
            $push: {
              statusHistory: {
                fromStatus: app.status,
                toStatus: normalizedTarget,
                changedAt: now,
                changedBy: String(viewer.id),
                reason: String(reason || "Bulk status update").trim(),
              },
            },
          },
        },
      });

      outboxDocs.push({
        eventType: "APPLICATION_STATUS_CHANGED",
        aggregateId: String(app._id),
        status: "pending",
        payload: {
          application_id: String(app._id),
          job_id: app.jobId,
          resume_id: app.resumeId,
          candidate_id: app.candidateId,
          from_status: app.status,
          to_status: normalizedTarget,
          changed_by: String(viewer.id),
          changed_at: now.toISOString(),
        },
      });
    }

    let updatedCount = 0;
    if (bulkOps.length > 0) {
      const result = await ApplicationModel.bulkWrite(bulkOps, { ordered: false });
      updatedCount = Number(result?.modifiedCount ?? result?.nModified ?? bulkOps.length);
      if (outboxDocs.length > 0) {
        await OutboxEventModel.insertMany(outboxDocs);
      }
    }

    return {
      updatedCount,
      skippedCount: errors.length,
      errors,
      durationMs: Date.now() - startedAt,
    };
  }

  async function processAiScoring({
    applicationId,
    semanticWeight = defaultSemanticWeight,
    mockScoringResult = null,
  }) {
    const app = await ApplicationModel.findById(applicationId);
    if (!app) {
      throw createHttpError(404, "Application not found", "application_not_found");
    }

    app.aiStatus = "scoring";
    await app.save();

    const rawResult =
      mockScoringResult ||
      (scoringStep ? await scoringStep(app, semanticWeight) : { semanticScore: 0, keywordScore: 0 });

    const scores = computeHybridScore({
      semanticScore: rawResult.semanticScore ?? 0,
      keywordScore: rawResult.keywordScore ?? 0,
      semanticWeight,
    });

    app.aiStatus = "completed";
    app.aiScores = {
      semanticScore: scores.semanticScore,
      keywordScore: scores.keywordScore,
      hybridScore: rawResult.hybridScore !== undefined ? Number(rawResult.hybridScore) : scores.hybridScore,
    };
    app.aiDetails = {
      matchedKeywords: Array.isArray(rawResult.matchedKeywords) ? rawResult.matchedKeywords : [],
      missingKeywords: Array.isArray(rawResult.missingKeywords) ? rawResult.missingKeywords : [],
    };
    app.scoringError = "";
    await app.save();

    if (redisBus && typeof redisBus.publishEvent === "function") {
      await redisBus.publishEvent(PUBSUB_CHANNELS.APPLICATION_SCORED, {
        application_id: String(app._id),
        job_id: app.jobId,
        resume_id: app.resumeId,
        candidate_id: app.candidateId,
        recruiter_id: app.recruiterId || "",
        ai_status: "completed",
        scores: app.aiScores,
        semantic_weight: semanticWeight,
      });
    }

    return app;
  }

  async function markScoringFailed({ applicationId, errorMessage = "" }) {
    const app = await ApplicationModel.findById(applicationId);
    if (!app) {
      throw createHttpError(404, "Application not found", "application_not_found");
    }
    app.aiStatus = "failed";
    app.scoringError = String(errorMessage || "Scoring failed after max retries");
    await app.save();
    return app;
  }

  async function listRankedByJob({
    jobId,
    status = null,
    aiStatus = null,
    minScore = null,
    maxScore = null,
    page = 1,
    limit = 20,
  } = {}) {
    if (!jobId) {
      throw createHttpError(400, "job_id is required", "missing_job_id");
    }
    const filter = { jobId: String(jobId) };
    if (status) filter.status = String(status).toLowerCase();
    if (aiStatus) filter.aiStatus = String(aiStatus).toLowerCase();

    const parsedMin = minScore !== null && minScore !== undefined && minScore !== "" ? Number(minScore) : null;
    const parsedMax = maxScore !== null && maxScore !== undefined && maxScore !== "" ? Number(maxScore) : null;
    if (Number.isFinite(parsedMin) || Number.isFinite(parsedMax)) {
      filter["aiScores.hybridScore"] = {};
      if (Number.isFinite(parsedMin)) {
        filter["aiScores.hybridScore"].$gte = parsedMin > 1 ? parsedMin / 100 : parsedMin;
      }
      if (Number.isFinite(parsedMax)) {
        filter["aiScores.hybridScore"].$lte = parsedMax > 1 ? parsedMax / 100 : parsedMax;
      }
    }

    const { skip, limit: safeLimit, page: safePage } = normalizePagination({ page, limit });
    const [items, total] = await Promise.all([
      ApplicationModel.find(
        filter,
        null,
        {
          sort: { "aiScores.hybridScore": -1, updatedAt: -1 },
          skip,
          limit: safeLimit,
        }
      ),
      ApplicationModel.countDocuments(filter),
    ]);

    return {
      applications: items,
      pagination: { page: safePage, limit: safeLimit, total },
    };
  }

  async function listCandidateHistory({
    candidateId,
    status = null,
    aiStatus = null,
    submittedAfter = null,
    submittedBefore = null,
  }) {
    const filter = { candidateId: String(candidateId) };
    if (status) filter.status = String(status).trim().toLowerCase();
    if (aiStatus) filter.aiStatus = String(aiStatus).trim().toLowerCase();

    if (submittedAfter || submittedBefore) {
      filter.createdAt = {};
      if (submittedAfter) {
        const afterDate = new Date(submittedAfter);
        if (!Number.isNaN(afterDate.getTime())) {
          filter.createdAt.$gte = afterDate;
        }
      }
      if (submittedBefore) {
        const rawBefore = String(submittedBefore).trim();
        const beforeDate = /^\d{4}-\d{2}-\d{2}$/.test(rawBefore)
          ? new Date(`${rawBefore}T23:59:59.999Z`)
          : new Date(rawBefore);
        if (!Number.isNaN(beforeDate.getTime())) {
          filter.createdAt.$lte = beforeDate;
        }
      }
      if (Object.keys(filter.createdAt).length === 0) {
        delete filter.createdAt;
      }
    }

    return ApplicationModel.find(filter, null, { sort: { createdAt: -1 } });
  }

  async function assertCanViewApplication(app, viewer) {
    if (String(app.candidateId) === String(viewer.id)) return;
    if (hasAnyRole(viewer.role, [ROLES.TECH_STAFF, ROLES.PLATFORM_OWNER, ROLES.RECRUITER])) {
      return;
    }
    throw createHttpError(403, "Forbidden application access", "forbidden_application_access");
  }

  async function getApplicationById({ applicationId, viewer }) {
    const app = await ApplicationModel.findById(applicationId);
    if (!app) {
      throw createHttpError(404, "Application not found", "application_not_found");
    }
    await assertCanViewApplication(app, viewer);
    return app;
  }

  async function getApplicationFeedback({ applicationId, viewer }) {
    const app = await getApplicationById({ applicationId, viewer });
    return {
      application_id: String(app._id),
      job_id: app.jobId ? String(app.jobId) : null,
      resume_id: app.resumeId ? String(app.resumeId) : null,
      status: app.status,
      ai_status: app.aiStatus,
      scores: app.aiScores,
      explainability: app.aiDetails,
    };
  }

  async function getStatusHistory({ applicationId, viewer }) {
    const app = await getApplicationById({ applicationId, viewer });
    return {
      application_id: String(app._id),
      current_status: app.status,
      status_history: app.statusHistory || [],
    };
  }

  async function checkRecruiterAccess({ recruiterId, candidateId = null, resumeId = null }) {
    const filter = { recruiterId: String(recruiterId), status: { $ne: "withdrawn" } };
    if (candidateId) filter.candidateId = String(candidateId);
    if (resumeId) filter.resumeId = String(resumeId);
    const match = await ApplicationModel.findOne(filter);
    return Boolean(match);
  }

  return {
    submitApplication,
    withdrawApplication,
    updateApplicationStatus,
    triggerScoringRetry,
    bulkUpdateStatus,
    processAiScoring,
    markScoringFailed,
    listRankedByJob,
    listCandidateHistory,
    getApplicationById,
    getApplicationFeedback,
    getStatusHistory,
    checkRecruiterAccess,
  };
}
