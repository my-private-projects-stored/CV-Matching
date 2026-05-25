import Application from "../models/Application.js";
import Job from "../models/Job.js";
import Resume from "../models/Resume.js";
import User from "../models/User.js";
import { enqueueApplicationScoring } from "./application-queue.service.js";
import {
  enqueueStatusChangedNotification,
} from "./notification-queue.service.js";

const APPLICATION_STATUSES = new Set(["new", "screening", "interview", "offer", "hired", "rejected"]);
const APPLICATION_STATUS_ORDER = ["new", "screening", "interview", "offer", "hired", "rejected"];
const AI_STATUS_ORDER = ["pending", "parsing", "scoring", "completed", "failed"];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizePagination(query = {}) {
  const page = Math.max(1, Number.parseInt(String(query.page || "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(query.limit || "20"), 10) || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

function parseDateFilter(value, mode = "start") {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return { error: `Invalid date value: ${text}` };
  }

  // Support date-only filters from UI date picker by widening the end boundary.
  if (mode === "end" && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
    parsed.setUTCHours(23, 59, 59, 999);
  }

  return parsed;
}

function buildCandidateSuggestions(missingKeywords = []) {
  if (!Array.isArray(missingKeywords) || missingKeywords.length === 0) {
    return ["Your profile already matches core requirements for this job."];
  }

  return missingKeywords.slice(0, 5).map((keyword) => `Consider adding evidence for: ${keyword}`);
}

function toRankedApplicationDto(appDoc) {
  const resume = appDoc.resumeId || {};
  const candidate = resume.candidateId || {};

  const history = Array.isArray(appDoc.statusHistory) ? appDoc.statusHistory : [];
  const lastStatusChange = history.length ? history[history.length - 1] : null;

  return {
    application_id: String(appDoc._id),
    status: appDoc.status,
    ai_status: appDoc.aiStatus,
    candidate: {
      id: candidate._id ? String(candidate._id) : null,
      full_name: candidate.fullName || "Unknown candidate",
      email: candidate.email || "",
    },
    resume: {
      id: resume._id ? String(resume._id) : null,
      title: resume.title || null,
      processing_status: resume.processingStatus || "pending",
    },
    scores: {
      semantic_score: Number(appDoc.aiScores?.semanticScore || 0),
      keyword_score: Number(appDoc.aiScores?.keywordScore || 0),
      hybrid_score: Number(appDoc.aiScores?.hybridScore || 0),
    },
    explainability: {
      matched_keywords: Array.isArray(appDoc.aiDetails?.matchedKeywords)
        ? appDoc.aiDetails.matchedKeywords
        : [],
      missing_keywords: Array.isArray(appDoc.aiDetails?.missingKeywords)
        ? appDoc.aiDetails.missingKeywords
        : [],
    },
    updated_at: appDoc.updatedAt,
    status_audit: lastStatusChange
      ? {
          from_status: lastStatusChange.fromStatus || null,
          to_status: lastStatusChange.toStatus || appDoc.status,
          changed_at: lastStatusChange.changedAt || appDoc.updatedAt,
          changed_by: lastStatusChange.changedBy || "system",
        }
      : null,
  };
}

function toHistoryItemDto(appDoc) {
  const job = appDoc.jobId || {};
  const resume = appDoc.resumeId || {};
  const history = Array.isArray(appDoc.statusHistory) ? appDoc.statusHistory : [];
  const lastStatusChange = history.length ? history[history.length - 1] : null;

  return {
    application_id: String(appDoc._id),
    status: appDoc.status,
    ai_status: appDoc.aiStatus,
    job: {
      id: job._id ? String(job._id) : null,
      title: job.title || "Unknown job",
      status: job.status || "active",
      location: job.location || null,
      category: job.category || null,
    },
    resume: {
      id: resume._id ? String(resume._id) : null,
      title: resume.title || null,
      processing_status: resume.processingStatus || "pending",
    },
    scores: {
      hybrid_score: Number(appDoc.aiScores?.hybridScore || 0),
    },
    submitted_at: appDoc.createdAt,
    updated_at: appDoc.updatedAt,
    status_audit: lastStatusChange
      ? {
          from_status: lastStatusChange.fromStatus || null,
          to_status: lastStatusChange.toStatus || appDoc.status,
          changed_at: lastStatusChange.changedAt || appDoc.updatedAt,
          changed_by: lastStatusChange.changedBy || "system",
        }
      : null,
  };
}

function toStatusHistoryDto(entry = {}) {
  return {
    from_status: entry.fromStatus || null,
    to_status: entry.toStatus || null,
    changed_at: entry.changedAt || null,
    changed_by: entry.changedBy || "system",
  };
}

function toRecentStatusChangeDto(appDoc, entry = {}) {
  const resume = appDoc.resumeId || {};
  const candidate = resume.candidateId || {};
  const job = appDoc.jobId || {};

  return {
    application_id: String(appDoc._id),
    job: {
      id: job._id ? String(job._id) : null,
      title: job.title || "Unknown job",
    },
    candidate: {
      id: candidate._id ? String(candidate._id) : null,
      full_name: candidate.fullName || "Unknown candidate",
      email: candidate.email || "",
    },
    from_status: entry.fromStatus || null,
    to_status: entry.toStatus || appDoc.status,
    changed_at: entry.changedAt || appDoc.updatedAt,
    changed_by: entry.changedBy || "system",
    current_status: appDoc.status,
  };
}

function escapeCsvValue(value) {
  const normalized = String(value ?? "");
  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function buildRecentStatusChangesCsv(changes = []) {
  const headers = [
    "application_id",
    "job_id",
    "job_title",
    "candidate_id",
    "candidate_full_name",
    "candidate_email",
    "from_status",
    "to_status",
    "current_status",
    "changed_by",
    "changed_at",
  ];

  const rows = changes.map((item) =>
    [
      item.application_id,
      item.job?.id || "",
      item.job?.title || "",
      item.candidate?.id || "",
      item.candidate?.full_name || "",
      item.candidate?.email || "",
      item.from_status || "",
      item.to_status || "",
      item.current_status || "",
      item.changed_by || "",
      item.changed_at || "",
    ]
      .map((value) => escapeCsvValue(value))
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

async function collectRecentStatusChangesByJob(jobId, query = {}) {
  const normalizedJobId = normalizeText(jobId);
  if (!normalizedJobId) {
    return { error: "job_id is required", code: 400 };
  }

  const job = await Job.findById(normalizedJobId);
  if (!job) {
    return { error: "Job not found", code: 404 };
  }

  const statusFilter = normalizeText(query.status).toLowerCase();
  const changedByFilter = normalizeText(query.changed_by).toLowerCase();
  const changedAfter = parseDateFilter(query.changed_after, "start");
  if (changedAfter?.error) {
    return { error: changedAfter.error, code: 400 };
  }
  const changedBefore = parseDateFilter(query.changed_before, "end");
  if (changedBefore?.error) {
    return { error: changedBefore.error, code: 400 };
  }

  const appDocs = await Application.find({ jobId: job._id })
    .populate({
      path: "resumeId",
      populate: {
        path: "candidateId",
        model: User,
      },
    })
    .populate("jobId")
    .lean();

  const allChanges = [];
  for (const appDoc of appDocs) {
    const historyEntries = Array.isArray(appDoc.statusHistory) ? appDoc.statusHistory : [];
    for (const entry of historyEntries) {
      const changedAt = new Date(entry.changedAt || appDoc.updatedAt);
      if (Number.isNaN(changedAt.getTime())) {
        continue;
      }

      if (statusFilter && APPLICATION_STATUSES.has(statusFilter) && entry.toStatus !== statusFilter) {
        continue;
      }

      if (
        changedByFilter &&
        String(entry.changedBy || "system").toLowerCase().indexOf(changedByFilter) === -1
      ) {
        continue;
      }

      if (changedAfter && changedAt < changedAfter) {
        continue;
      }

      if (changedBefore && changedAt > changedBefore) {
        continue;
      }

      allChanges.push(toRecentStatusChangeDto(appDoc, entry));
    }
  }

  allChanges.sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

  return {
    data: {
      job: {
        id: String(job._id),
        title: job.title,
      },
      changes: allChanges,
    },
  };
}

export async function createApplication(payload = {}) {
  const jobId = normalizeText(payload.job_id);
  const resumeId = normalizeText(payload.resume_id);

  if (!jobId || !resumeId) {
    return { error: "job_id and resume_id are required", code: 400 };
  }

  const [job, resume] = await Promise.all([Job.findById(jobId), Resume.findById(resumeId)]);

  if (!job || !resume) {
    return { error: "Job or resume not found", code: 404 };
  }

  const existing = await Application.findOne({
    jobId: job._id,
    resumeId: resume._id,
  })
    .select("_id")
    .lean();

  if (existing) {
    return { error: "Application already exists for this job and resume", code: 409 };
  }

  try {
    const created = await Application.create({
      jobId: job._id,
      resumeId: resume._id,
      status: "new",
      aiStatus: "pending",
      aiScores: {
        semanticScore: 0,
        keywordScore: 0,
        hybridScore: 0,
      },
      aiDetails: {
        matchedKeywords: [],
        missingKeywords: [],
      },
      statusHistory: [
        {
          fromStatus: null,
          toStatus: "new",
          changedBy: normalizeText(payload.changed_by) || "system",
          changedAt: new Date(),
        },
      ],
    });

    try {
      await enqueueApplicationScoring(created._id);
    } catch (_error) {
      // Keep application creation successful even if queue is temporarily unavailable.
    }

    return {
      data: {
        application_id: String(created._id),
        job_id: String(job._id),
        resume_id: String(resume._id),
        status: created.status,
        ai_status: created.aiStatus,
      },
    };
  } catch (error) {
    if (error && typeof error === "object" && error.code === 11000) {
      return { error: "Application already exists for this job and resume", code: 409 };
    }

    throw error;
  }
}

export async function listRankedApplicationsByJob(jobId, query = {}) {
  const normalizedJobId = normalizeText(jobId);
  if (!normalizedJobId) {
    return { error: "job_id is required", code: 400 };
  }

  const job = await Job.findById(normalizedJobId);
  if (!job) {
    return { error: "Job not found", code: 404 };
  }

  const { page, limit, skip } = normalizePagination(query);
  const filter = { jobId: job._id };

  const status = normalizeText(query.status).toLowerCase();
  if (status && APPLICATION_STATUSES.has(status)) {
    filter.status = status;
  }

  const aiStatus = normalizeText(query.ai_status || query.aiStatus).toLowerCase();
  if (aiStatus && AI_STATUS_ORDER.includes(aiStatus)) {
    filter.aiStatus = aiStatus;
  }

  const changedByFilter = normalizeText(query.changed_by).toLowerCase();
  const changedAfter = parseDateFilter(query.changed_after, "start");
  if (changedAfter?.error) {
    return { error: changedAfter.error, code: 400 };
  }
  const changedBefore = parseDateFilter(query.changed_before, "end");
  if (changedBefore?.error) {
    return { error: changedBefore.error, code: 400 };
  }

  const items = await Application.find(filter)
    .sort({ "aiScores.hybridScore": -1, updatedAt: -1 })
    .populate({
      path: "resumeId",
      populate: {
        path: "candidateId",
        model: User,
      },
    })
    .lean();

  let candidates = items.map(toRankedApplicationDto);

  const minScore = Number.parseFloat(String(query.min_score ?? query.minScore ?? ""));
  if (Number.isFinite(minScore)) {
    candidates = candidates.filter((item) => item.scores.hybrid_score >= minScore);
  }

  const maxScore = Number.parseFloat(String(query.max_score ?? query.maxScore ?? ""));
  if (Number.isFinite(maxScore)) {
    candidates = candidates.filter((item) => item.scores.hybrid_score <= maxScore);
  }

  const search = normalizeText(query.search).toLowerCase();
  if (search) {
    candidates = candidates.filter((item) =>
      [
        item.candidate?.full_name,
        item.candidate?.email,
        item.resume?.title,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search))
    );
  }
  if (changedByFilter) {
    candidates = candidates.filter((item) =>
      String(item.status_audit?.changed_by || "system")
        .toLowerCase()
        .includes(changedByFilter)
    );
  }

  if (changedAfter || changedBefore) {
    candidates = candidates.filter((item) => {
      const changedAt = item.status_audit?.changed_at;
      if (!changedAt) {
        return false;
      }

      const parsed = new Date(changedAt);
      if (Number.isNaN(parsed.getTime())) {
        return false;
      }

      if (changedAfter && parsed < changedAfter) {
        return false;
      }

      if (changedBefore && parsed > changedBefore) {
        return false;
      }

      return true;
    });
  }

  const total = candidates.length;
  candidates = candidates.slice(skip, skip + limit);

  return {
    data: {
      job: {
        id: String(job._id),
        title: job.title,
        status: job.status,
      },
      candidates,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
    },
  };
}

export async function listCandidateApplicationHistory(candidateId, query = {}) {
  const normalizedCandidateId = normalizeText(candidateId);
  if (!normalizedCandidateId) {
    return { error: "candidate_id is required", code: 400 };
  }

  const resumes = await Resume.find({ candidateId: normalizedCandidateId }).select("_id").lean();
  const resumeIds = resumes.map((item) => item._id);

  const { page, limit, skip } = normalizePagination(query);
  const filter = {
    resumeId: { $in: resumeIds },
  };

  const status = normalizeText(query.status).toLowerCase();
  if (status && APPLICATION_STATUSES.has(status)) {
    filter.status = status;
  }

  const [items, total] = await Promise.all([
    Application.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("jobId")
      .populate("resumeId")
      .lean(),
    Application.countDocuments(filter),
  ]);

  return {
    data: {
      candidate_id: normalizedCandidateId,
      applications: items.map(toHistoryItemDto),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
    },
  };
}

export async function updateApplicationStatus(applicationId, status, changedByInput) {
  const normalizedStatus = normalizeText(status).toLowerCase();
  if (!APPLICATION_STATUSES.has(normalizedStatus)) {
    return { error: "Invalid status", code: 400 };
  }

  const application = await Application.findById(applicationId);
  if (!application) {
    return { error: "Application not found", code: 404 };
  }

  const currentStatus = application.status;
  if (currentStatus === normalizedStatus) {
    return {
      data: {
        application_id: String(application._id),
        status: application.status,
        ai_status: application.aiStatus,
        updated_at: application.updatedAt,
      },
    };
  }

  const changedBy = normalizeText(changedByInput).slice(0, 120) || "system";
  application.status = normalizedStatus;
  application.statusHistory.push({
    fromStatus: currentStatus,
    toStatus: normalizedStatus,
    changedBy,
    changedAt: new Date(),
  });

  const updated = await application.save();

  // Fire-and-forget: enqueue notification for the candidate
  enqueueStatusChangedNotification({
    applicationId: String(updated._id),
    fromStatus: currentStatus,
    toStatus: normalizedStatus,
  }).catch((err) => {
    console.warn("[application.service] failed to enqueue status_changed notification", err.message);
  });

  return {
    data: {
      application_id: String(updated._id),
      status: updated.status,
      ai_status: updated.aiStatus,
      updated_at: updated.updatedAt,
    },
  };
}

export async function bulkUpdateApplicationStatus(payload = {}) {
  const applicationIds = Array.isArray(payload.application_ids)
    ? payload.application_ids.map((value) => normalizeText(value)).filter(Boolean)
    : [];
  if (!applicationIds.length) {
    return { error: "application_ids is required", code: 400 };
  }

  const normalizedStatus = normalizeText(payload.status).toLowerCase();
  if (!APPLICATION_STATUSES.has(normalizedStatus)) {
    return { error: "Invalid status", code: 400 };
  }

  const changedBy = normalizeText(payload.changed_by).slice(0, 120) || "system";
  const applications = await Application.find({ _id: { $in: applicationIds } });
  if (!applications.length) {
    return { error: "Applications not found", code: 404 };
  }

  const updatedIds = [];
  for (const application of applications) {
    const currentStatus = application.status;
    if (currentStatus === normalizedStatus) {
      continue;
    }

    application.status = normalizedStatus;
    application.statusHistory.push({
      fromStatus: currentStatus,
      toStatus: normalizedStatus,
      changedBy,
      changedAt: new Date(),
    });
    await application.save();
    updatedIds.push(String(application._id));

    // Fire-and-forget: enqueue notification per candidate
    enqueueStatusChangedNotification({
      applicationId: String(application._id),
      fromStatus: currentStatus,
      toStatus: normalizedStatus,
    }).catch((err) => {
      console.warn("[application.service] bulk: failed to enqueue status_changed notification", err.message);
    });
  }

  return {
    data: {
      requested_count: applicationIds.length,
      matched_count: applications.length,
      updated_count: updatedIds.length,
      unchanged_count: applications.length - updatedIds.length,
      updated_ids: updatedIds,
      status: normalizedStatus,
    },
  };
}

export async function getApplicationFeedback(applicationId) {
  const appDoc = await Application.findById(applicationId)
    .populate("jobId")
    .populate({
      path: "resumeId",
      populate: {
        path: "candidateId",
        model: User,
      },
    })
    .lean();

  if (!appDoc) {
    return { error: "Application not found", code: 404 };
  }

  const matchedKeywords = Array.isArray(appDoc.aiDetails?.matchedKeywords)
    ? appDoc.aiDetails.matchedKeywords
    : [];
  const missingKeywords = Array.isArray(appDoc.aiDetails?.missingKeywords)
    ? appDoc.aiDetails.missingKeywords
    : [];

  return {
    data: {
      application_id: String(appDoc._id),
      job_id: appDoc.jobId?._id ? String(appDoc.jobId._id) : null,
      resume_id: appDoc.resumeId?._id ? String(appDoc.resumeId._id) : null,
      scores: {
        semantic_score: Number(appDoc.aiScores?.semanticScore || 0),
        keyword_score: Number(appDoc.aiScores?.keywordScore || 0),
        hybrid_score: Number(appDoc.aiScores?.hybridScore || 0),
      },
      explainability: {
        matched_keywords: matchedKeywords,
        missing_keywords: missingKeywords,
      },
      recommendations: buildCandidateSuggestions(missingKeywords),
      status: appDoc.status,
      ai_status: appDoc.aiStatus,
    },
  };
}

export async function getApplicationStatusHistory(applicationId) {
  const appDoc = await Application.findById(applicationId).lean();
  if (!appDoc) {
    return { error: "Application not found", code: 404 };
  }

  const entries = Array.isArray(appDoc.statusHistory) ? appDoc.statusHistory : [];

  return {
    data: {
      application_id: String(appDoc._id),
      current_status: appDoc.status,
      history: [...entries]
        .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
        .map(toStatusHistoryDto),
    },
  };
}

export async function getApplicationStatusSummaryByJob(jobId) {
  const normalizedJobId = normalizeText(jobId);
  if (!normalizedJobId) {
    return { error: "job_id is required", code: 400 };
  }

  const job = await Job.findById(normalizedJobId);
  if (!job) {
    return { error: "Job not found", code: 404 };
  }

  const rows = await Application.aggregate([
    {
      $match: {
        jobId: job._id,
      },
    },
    {
      $group: {
        _id: {
          status: "$status",
          aiStatus: "$aiStatus",
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const byStatus = {};
  const byAiStatus = {};

  for (const key of APPLICATION_STATUS_ORDER) {
    byStatus[key] = 0;
  }

  for (const key of AI_STATUS_ORDER) {
    byAiStatus[key] = 0;
  }

  let total = 0;
  for (const row of rows) {
    const count = Number(row.count || 0);
    total += count;

    const status = String(row._id?.status || "");
    const aiStatus = String(row._id?.aiStatus || "");

    if (status in byStatus) {
      byStatus[status] += count;
    }
    if (aiStatus in byAiStatus) {
      byAiStatus[aiStatus] += count;
    }
  }

  return {
    data: {
      job: {
        id: String(job._id),
        title: job.title,
      },
      total,
      by_status: byStatus,
      by_ai_status: byAiStatus,
    },
  };
}

export async function listRecentStatusChangesByJob(jobId, query = {}) {
  const baseResult = await collectRecentStatusChangesByJob(jobId, query);
  if (baseResult.error) {
    return baseResult;
  }

  const { job, changes } = baseResult.data;
  const { page, limit, skip } = normalizePagination(query);
  const total = changes.length;
  const items = changes.slice(skip, skip + limit);

  return {
    data: {
      job: {
        id: job.id,
        title: job.title,
      },
      changes: items,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
    },
  };
}

export async function exportRecentStatusChangesCsvByJob(jobId, query = {}) {
  const baseResult = await collectRecentStatusChangesByJob(jobId, query);
  if (baseResult.error) {
    return baseResult;
  }

  const { job, changes } = baseResult.data;
  return {
    data: {
      job,
      csv: buildRecentStatusChangesCsv(changes),
    },
  };
}
