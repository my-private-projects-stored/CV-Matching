import Job from "../models/Job.js";
import Application from "../models/Application.js";
import Company from "../models/Company.js";
import { ensureQdrantId } from "../utils/qdrant-id.js";
import { generateEmbedding } from "./embedding.service.js";
import { deleteJobVector, upsertJobVector } from "./vector-index.service.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function hasOwn(payload, key) {
  return Object.prototype.hasOwnProperty.call(payload, key);
}

function toBoolean(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function normalizeOptionalDate(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const err = new Error("applicationDeadline must be a valid ISO date");
    err.statusCode = 400;
    throw err;
  }

  return parsed;
}

function buildImportantChangeSummary(changedFields = []) {
  if (!changedFields.length) return "";
  return `Updated fields: ${changedFields.join(", ")}`;
}

function serializeHistoryValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function collectImportantChangeDetails(job, payload = {}) {
  const tracked = [
    "title",
    "description",
    "requirements",
    "benefits",
    "applicationDeadline",
    "status",
  ];

  const changes = [];
  for (const field of tracked) {
    if (!hasOwn(payload, field)) continue;

    const before = serializeHistoryValue(job[field]);
    const after = serializeHistoryValue(payload[field]);

    if (before !== after) {
      changes.push({
        field,
        before,
        after,
      });
    }
  }

  return changes;
}

function normalizeJobPayload(payload = {}) {
  const normalized = {
    ...payload,
  };

  if (hasOwn(payload, "title")) {
    normalized.title = normalizeText(payload.title);
  }

  if (hasOwn(payload, "description")) {
    normalized.description = normalizeText(payload.description);
  }

  if (hasOwn(payload, "requirements")) {
    normalized.requirements = normalizeText(payload.requirements);
  }

  if (hasOwn(payload, "benefits")) {
    normalized.benefits = normalizeText(payload.benefits);
  }

  if (hasOwn(payload, "applicationDeadline")) {
    normalized.applicationDeadline = normalizeOptionalDate(payload.applicationDeadline);
  }

  if (hasOwn(payload, "cleanText")) {
    normalized.cleanText = normalizeText(payload.cleanText);
  }

  return normalized;
}

function buildJobListFilter(query = {}) {
  const filter = {};

  const includeDeleted = toBoolean(query.includeDeleted ?? query.include_deleted);

  if (!includeDeleted) {
    filter.status = { $ne: "deleted" };
  }

  if (query.status && ["active", "closed", "deleted"].includes(query.status)) {
    filter.status = query.status;
  }

  if (query.category && ["IT", "Accounting", "Marketing"].includes(query.category)) {
    filter.category = query.category;
  }

  if (query.location) {
    filter.location = {
      $regex: normalizeText(query.location),
      $options: "i",
    };
  }

  if (query.search) {
    const keyword = normalizeText(query.search);
    if (keyword) {
      filter.$or = [
        { title: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
        { requirements: { $regex: keyword, $options: "i" } },
      ];
    }
  }

  return filter;
}

function isAdmin(options = {}) {
  return String(options.role || "").trim().toLowerCase() === "admin";
}

function applyOwnershipFilter(filter, options = {}) {
  const role = String(options.role || "").trim().toLowerCase();
  const userId = String(options.userId || "").trim();
  if (role === "recruiter" && userId) {
    filter.recruiterId = userId;
  }
  return filter;
}

function canAccessJob(job, options = {}) {
  if (!job) return false;
  if (isAdmin(options)) return true;
  const role = String(options.role || "").trim().toLowerCase();
  if (role !== "recruiter") return true;
  return String(job.recruiterId || "") === String(options.userId || "");
}

function createForbiddenError() {
  const error = new Error("You do not have permission to access this job");
  error.statusCode = 403;
  return error;
}

function shouldRegenerateJobEmbedding(payload = {}) {
  return ["cleanText", "description", "requirements", "title", "benefits"].some(
    (key) => key in payload
  );
}

function extractJobEmbeddingText(job) {
  if (job.cleanText && String(job.cleanText).trim()) {
    return String(job.cleanText);
  }

  return [job.title, job.description, job.requirements, job.benefits].filter(Boolean).join("\n");
}

async function getApplicationCountsByJobIds(jobIds = []) {
  if (!Array.isArray(jobIds) || jobIds.length === 0) {
    return new Map();
  }

  const rows = await Application.aggregate([
    {
      $match: {
        jobId: { $in: jobIds },
      },
    },
    {
      $group: {
        _id: "$jobId",
        total: { $sum: 1 },
      },
    },
  ]);

  const counts = new Map();
  for (const row of rows) {
    counts.set(String(row._id), Number(row.total || 0));
  }

  return counts;
}

// Tao JD moi va gan qdrantId de dong bo voi vector store.
export async function createJob(payload) {
  const { embeddingVector, ...jobData } = normalizeJobPayload(payload);
  if (!jobData.companyId && jobData.recruiterId) {
    const company = await Company.findOne({ recruiterId: jobData.recruiterId }).select("_id").lean();
    if (company?._id) {
      jobData.companyId = company._id;
    }
  }
  if (!jobData.cleanText) {
    jobData.cleanText = [jobData.title, jobData.description, jobData.requirements, jobData.benefits]
      .filter(Boolean)
      .join("\n");
  }
  const job = new Job(jobData);
  ensureQdrantId(job);
  const saved = await job.save();
  let vector = embeddingVector;

  if (!Array.isArray(vector) || vector.length === 0) {
    try {
      vector = await generateEmbedding(extractJobEmbeddingText(saved));
    } catch (error) {
      console.warn("[job-index] embedding generation failed, job saved without vector", error.message);
      vector = null;
    }
  }

  if (Array.isArray(vector) && vector.length > 0 && saved.status === "active") {
    try {
      await upsertJobVector({
        qdrantId: saved.qdrantId,
        vector,
        payload: {
          mongoId: String(saved._id),
          category: saved.category,
          status: saved.status,
        },
      });

      saved.isAnalyzed = true;
      await saved.save();
    } catch (error) {
      console.warn("[job-index] vector upsert failed, job saved without vector", error.message);
    }
  }

  return saved;
}

// Cap nhat JD va dam bao qdrantId ton tai cho ban ghi cu.
export async function updateJobById(jobId, payload, options = {}) {
  const { embeddingVector, ...jobData } = normalizeJobPayload(payload);
  const job = await Job.findById(jobId);
  if (!job) return null;
  if (!canAccessJob(job, options)) {
    throw createForbiddenError();
  }

  if (!hasOwn(jobData, "cleanText") && shouldRegenerateJobEmbedding(jobData)) {
    const title = hasOwn(jobData, "title") ? jobData.title : job.title;
    const description = hasOwn(jobData, "description") ? jobData.description : job.description;
    const requirements = hasOwn(jobData, "requirements") ? jobData.requirements : job.requirements;
    const benefits = hasOwn(jobData, "benefits") ? jobData.benefits : job.benefits;
    jobData.cleanText = [title, description, requirements, benefits].filter(Boolean).join("\n");
  }

  const changeDetails = collectImportantChangeDetails(job, jobData);
  const changedFields = changeDetails.map((item) => item.field);

  Object.assign(job, jobData);

  if (changedFields.length > 0) {
    job.importantChangeHistory = [
      ...(Array.isArray(job.importantChangeHistory) ? job.importantChangeHistory : []),
      {
        changedAt: new Date(),
        changedFields,
        changes: changeDetails,
        summary: buildImportantChangeSummary(changedFields),
      },
    ].slice(-50);
  }

  ensureQdrantId(job);
  const saved = await job.save();
  const mustRegenerate = shouldRegenerateJobEmbedding(jobData);

  if (saved.status !== "active") {
    await deleteJobVector(saved.qdrantId);
    saved.isAnalyzed = false;
    await saved.save();
    return saved;
  }

  let vector = embeddingVector;
  if ((!Array.isArray(vector) || vector.length === 0) && mustRegenerate) {
    vector = await generateEmbedding(extractJobEmbeddingText(saved));
  }

  if (Array.isArray(vector) && vector.length > 0) {
    await upsertJobVector({
      qdrantId: saved.qdrantId,
      vector,
      payload: {
        mongoId: String(saved._id),
        category: saved.category,
        status: saved.status,
      },
    });

    saved.isAnalyzed = true;
    await saved.save();
  }

  return saved;
}

export async function deleteJobById(jobId, options = {}) {
  const job = await Job.findById(jobId);
  if (!job) return null;
  if (!canAccessJob(job, options)) {
    throw createForbiddenError();
  }

  if (job.status !== "deleted") {
    const deletedAt = new Date();
    const statusBefore = job.status;

    job.status = "deleted";
    job.deletedAt = deletedAt;
    job.importantChangeHistory = [
      ...(Array.isArray(job.importantChangeHistory) ? job.importantChangeHistory : []),
      {
        changedAt: deletedAt,
        changedFields: ["status"],
        changes: [
          {
            field: "status",
            before: statusBefore,
            after: "deleted",
          },
        ],
        summary: "Soft deleted job",
      },
    ].slice(-50);

    await job.save();
  }

  await deleteJobVector(job.qdrantId);
  return job;
}

export async function getJobById(jobId, options = {}) {
  const job = await Job.findById(jobId).lean();
  if (!job) return null;
  if (!canAccessJob(job, options)) {
    throw createForbiddenError();
  }

  const includeDeleted = Boolean(options.includeDeleted);
  if (job.status === "deleted" && !includeDeleted) {
    return null;
  }

  const counts = await getApplicationCountsByJobIds([job._id]);
  return {
    ...job,
    applications_count: counts.get(String(job._id)) || 0,
  };
}

export async function listJobs(query = {}, options = {}) {
  const page = Math.max(1, Number.parseInt(String(query.page || "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(query.limit || "20"), 10) || 20));
  const skip = (page - 1) * limit;

  const filter = applyOwnershipFilter(buildJobListFilter(query), options);

  const [items, total] = await Promise.all([
    Job.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Job.countDocuments(filter),
  ]);

  const counts = await getApplicationCountsByJobIds(items.map((item) => item._id));
  const data = items.map((item) => ({
    ...item,
    applications_count: counts.get(String(item._id)) || 0,
  }));

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
