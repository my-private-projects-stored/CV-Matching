import { PUBSUB_CHANNELS, ROLES, createHttpError, hasAnyRole } from "@cvm/shared";

const VALID_JOB_STATUSES = new Set(["draft", "active", "open", "closed", "deleted"]);

function isPublishableStatus(status) {
  return status === "active" || status === "open";
}

function buildJobEmbeddingText(job) {
  return [
    job.title,
    job.companyName,
    job.category,
    job.location,
    Array.isArray(job.skills) ? job.skills.join(" ") : "",
    job.description,
    job.requirements,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Job lifecycle, Qdrant jobs_vectors sync, Redis cache invalidation, and JOB_STATUS_CHANGED publisher.
 */
export function createJobService({
  JobModel,
  CompanyModel = null,
  embeddingClient = null,
  vectorStore = null,
  redisBus = null,
} = {}) {
  async function invalidateJobsCache() {
    if (redisBus && typeof redisBus.cacheInvalidateByPrefix === "function") {
      await redisBus.cacheInvalidateByPrefix("jobs:cache:");
    }
  }

  async function publishJobStatusChanged({ job, previousStatus }) {
    if (redisBus && typeof redisBus.publishEvent === "function") {
      await redisBus.publishEvent(PUBSUB_CHANNELS.JOB_STATUS_CHANGED, {
        jobId: String(job._id),
        recruiterId: String(job.recruiterId),
        previousStatus,
        status: job.status,
      });
    }
  }

  async function syncPublishedVector(job) {
    if (!embeddingClient || !vectorStore) return;
    const vector = await embeddingClient.embedText(buildJobEmbeddingText(job));
    await vectorStore.upsertJobVector({
      jobId: String(job._id),
      category: job.category || "general",
      status: job.status,
      vector,
    });
    job.vectorUpdatedAt = new Date();
  }

  async function createJob({ recruiterId, payload = {} }) {
    const title = String(payload.title || "").trim();
    const description = String(payload.description || "").trim();
    if (!title || !description) {
      throw createHttpError(400, "Job title and description are required", "invalid_job_payload");
    }

    const status = String(payload.status || "draft").trim().toLowerCase();
    if (!VALID_JOB_STATUSES.has(status) || status === "deleted") {
      throw createHttpError(400, "Invalid initial job status", "invalid_job_status");
    }

    let companyId = payload.companyId ? String(payload.companyId) : "";
    let companyName = String(payload.companyName || "").trim();
    if (CompanyModel && !companyName) {
      const company = await CompanyModel.findOne({ ownerId: String(recruiterId) });
      if (company) {
        companyId = String(company._id);
        companyName = company.name;
      }
    }

    const job = await JobModel.create({
      recruiterId: String(recruiterId),
      companyId,
      companyName,
      title,
      description,
      requirements: String(payload.requirements || "").trim(),
      benefits: String(payload.benefits || "").trim(),
      applicationDeadline: payload.applicationDeadline ? new Date(payload.applicationDeadline) : null,
      skills: Array.isArray(payload.skills)
        ? payload.skills.map((s) => String(s).trim()).filter(Boolean)
        : [],
      category: String(payload.category || "general").trim(),
      location: String(payload.location || "").trim(),
      employmentType: String(payload.employmentType || "full-time").trim(),
      experienceLevel: String(payload.experienceLevel || "").trim(),
      salaryMin: payload.salaryMin !== undefined ? Number(payload.salaryMin) : null,
      salaryMax: payload.salaryMax !== undefined ? Number(payload.salaryMax) : null,
      salaryCurrency: String(payload.salaryCurrency || "VND").trim(),
      status,
    });

    if (isPublishableStatus(job.status)) {
      await syncPublishedVector(job);
      await job.save();
      await invalidateJobsCache();
    }

    return job;
  }

  function assertJobOwnership(job, viewer) {
    const isOwner = String(job.recruiterId) === String(viewer.id);
    const isOps = hasAnyRole(viewer.role, [ROLES.TECH_STAFF, ROLES.PLATFORM_OWNER]);
    if (!isOwner && !isOps) {
      throw createHttpError(403, "Forbidden job modification", "forbidden_job_access");
    }
  }

  async function updateJob({ jobId, viewer, payload = {} }) {
    const job = await JobModel.findById(jobId);
    if (!job || job.status === "deleted") {
      throw createHttpError(404, "Job not found", "job_not_found");
    }
    assertJobOwnership(job, viewer);

    const previousStatus = job.status;
    if (payload.title !== undefined) job.title = String(payload.title).trim();
    if (payload.description !== undefined) job.description = String(payload.description).trim();
    if (payload.requirements !== undefined) job.requirements = String(payload.requirements).trim();
    if (payload.benefits !== undefined) job.benefits = String(payload.benefits).trim();
    if (payload.applicationDeadline !== undefined) {
      job.applicationDeadline = payload.applicationDeadline ? new Date(payload.applicationDeadline) : null;
    }
    if (Array.isArray(payload.skills)) {
      job.skills = payload.skills.map((s) => String(s).trim()).filter(Boolean);
    }
    if (payload.category !== undefined) job.category = String(payload.category).trim();
    if (payload.location !== undefined) job.location = String(payload.location).trim();
    if (payload.employmentType !== undefined) job.employmentType = String(payload.employmentType).trim();
    if (payload.experienceLevel !== undefined) job.experienceLevel = String(payload.experienceLevel).trim();
    if (payload.salaryMin !== undefined) job.salaryMin = payload.salaryMin;
    if (payload.salaryMax !== undefined) job.salaryMax = payload.salaryMax;
    if (payload.status !== undefined) {
      const nextStatus = String(payload.status).trim().toLowerCase();
      if (!VALID_JOB_STATUSES.has(nextStatus)) {
        throw createHttpError(400, "Invalid job status", "invalid_job_status");
      }
      job.status = nextStatus;
      if (nextStatus === "deleted") {
        job.deletedAt = new Date();
      }
    }

    if (isPublishableStatus(job.status)) {
      await syncPublishedVector(job);
      await job.save();
      await invalidateJobsCache();
      if (previousStatus !== job.status) {
        await publishJobStatusChanged({ job, previousStatus });
      }
      return job;
    }

    await job.save();
    if (job.status === "closed" || job.status === "deleted") {
      if (vectorStore) {
        await vectorStore.deleteJobVector(String(job._id));
      }
      await invalidateJobsCache();
      if (previousStatus !== job.status) {
        await publishJobStatusChanged({ job, previousStatus });
      }
    }

    return job;
  }

  async function closeJob({ jobId, viewer }) {
    return updateJob({ jobId, viewer, payload: { status: "closed" } });
  }

  async function softDeleteJob({ jobId, viewer }) {
    return updateJob({ jobId, viewer, payload: { status: "deleted" } });
  }

  async function listPublicJobs({ search = "", category = "", location = "", status = "", page = 1, limit = 20, viewer = null } = {}) {
    const filter = { status: { $in: ["active", "open"] } };
    if (viewer?.role === ROLES.RECRUITER && viewer?.id) {
      filter.recruiterId = String(viewer.id);
      if (status && String(status).trim()) {
        filter.status = String(status).trim().toLowerCase();
      } else {
        filter.status = { $ne: "deleted" };
      }
    }
    if (category) filter.category = String(category).trim();
    if (location) filter.location = new RegExp(String(location).trim(), "i");
    if (search && String(search).trim()) {
      const rx = new RegExp(String(search).trim(), "i");
      filter.$or = [{ title: rx }, { description: rx }, { companyName: rx }];
    }

    const safeLimit = Math.min(100, Math.max(1, Number.parseInt(String(limit), 10) || 20));
    const safePage = Math.max(1, Number.parseInt(String(page), 10) || 1);
    const skip = (safePage - 1) * safeLimit;

    const [jobs, total] = await Promise.all([
      JobModel.find(filter, null, { sort: { createdAt: -1 }, skip, limit: safeLimit }),
      JobModel.countDocuments(filter),
    ]);

    return {
      jobs,
      pagination: { page: safePage, limit: safeLimit, total },
    };
  }

  async function listRecruiterJobs({ recruiterId, status = null } = {}) {
    const filter = { recruiterId: String(recruiterId), status: { $ne: "deleted" } };
    if (status) filter.status = String(status);
    return JobModel.find(filter, null, { sort: { updatedAt: -1 } });
  }

  async function getJobById({ jobId, viewer = null }) {
    const job = await JobModel.findById(jobId);
    if (!job || job.status === "deleted") {
      throw createHttpError(404, "Job not found", "job_not_found");
    }

    if (!isPublishableStatus(job.status)) {
      const isOwner = viewer?.id && String(job.recruiterId) === String(viewer.id);
      const isOps = viewer?.role && hasAnyRole(viewer.role, [ROLES.TECH_STAFF, ROLES.PLATFORM_OWNER]);
      if (!isOwner && !isOps) {
        throw createHttpError(404, "Job not found", "job_not_found");
      }
    }

    return job;
  }

  async function getJobInternal({ jobId }) {
    const job = await JobModel.findById(jobId);
    if (!job) {
      throw createHttpError(404, "Job not found", "job_not_found");
    }
    return job;
  }

  return {
    createJob,
    updateJob,
    closeJob,
    softDeleteJob,
    listPublicJobs,
    listRecruiterJobs,
    getJobById,
    getJobInternal,
  };
}
