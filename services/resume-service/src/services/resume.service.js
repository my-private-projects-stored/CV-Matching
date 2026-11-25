import crypto from "node:crypto";
import mongoose from "mongoose";
import {
  DEFAULT_PRESIGNED_TTL_SECONDS,
  MAX_RESUME_UPLOAD_BYTES,
  MINIO_BUCKETS,
  ROLES,
  createHttpError,
  hasAnyRole,
  validateResumeUpload,
} from "@cvm/shared";

function sha256Text(text) {
  return crypto.createHash("sha256").update(String(text || "")).digest("hex");
}

function buildTextFromBuilderData(builderData = {}) {
  const sections = builderData?.sections || {};
  const parts = [];
  if (sections.personalInfo) {
    parts.push(
      [sections.personalInfo.name, sections.personalInfo.title, sections.personalInfo.location]
        .filter(Boolean)
        .join(" ")
    );
  }
  if (sections.summary) parts.push(String(sections.summary));
  if (Array.isArray(sections.workExperience)) {
    for (const exp of sections.workExperience) {
      const desc = Array.isArray(exp.description) ? exp.description.join(" ") : exp.description;
      parts.push([exp.title, exp.company, desc].filter(Boolean).join(" "));
    }
  }
  if (Array.isArray(sections.education)) {
    for (const edu of sections.education) {
      parts.push([edu.degree, edu.institution, edu.description].filter(Boolean).join(" "));
    }
  }
  if (Array.isArray(sections.personalProjects)) {
    for (const proj of sections.personalProjects) {
      const desc = Array.isArray(proj.description) ? proj.description.join(" ") : proj.description;
      parts.push([proj.name, proj.role, desc].filter(Boolean).join(" "));
    }
  }
  if (Array.isArray(sections.additional?.technicalSkills)) {
    parts.push(sections.additional.technicalSkills.join(" "));
  }
  return parts.join("\n").trim();
}

function buildTextFromParsedData(parsedData = {}, fallbackRawText = "") {
  if (typeof fallbackRawText === "string" && fallbackRawText.trim()) {
    return fallbackRawText.trim();
  }
  const parts = [];
  if (parsedData.summary) parts.push(String(parsedData.summary));
  if (Array.isArray(parsedData.skills)) parts.push(parsedData.skills.join(" "));
  if (Array.isArray(parsedData.experience)) {
    for (const exp of parsedData.experience) {
      parts.push([exp.title, exp.company, exp.description].filter(Boolean).join(" "));
    }
  }
  if (Array.isArray(parsedData.education)) {
    for (const edu of parsedData.education) {
      parts.push([edu.degree, edu.institution, edu.field].filter(Boolean).join(" "));
    }
  }
  return parts.join("\n").trim();
}

/**
 * Resume domain service handling Magic Bytes upload validation, MinIO storage,
 * parsing/embedding/Qdrant sync, retry fallback, Resume Builder versioning, and anti-IDOR downloads.
 */
export function createResumeService({
  ResumeModel,
  minioStorage,
  parsingClient,
  embeddingClient,
  vectorStore,
  redisClient = null,
  retryQueueName = process.env.RESUME_RETRY_QUEUE_NAME || "resume_processing_retry_queue",
  canRecruiterAccessResume = async () => false,
} = {}) {
  async function enqueueRetry(payload) {
    if (!redisClient || typeof redisClient.lpush !== "function") return;
    try {
      await redisClient.lpush(retryQueueName, JSON.stringify(payload));
    } catch {
      // Best-effort enqueue
    }
  }

  async function syncVectorForResume(resumeDoc, textToEmbed) {
    const cleanText = String(textToEmbed || "").trim();
    if (!cleanText || !embeddingClient || !vectorStore) {
      return false;
    }

    const vector = await embeddingClient.embedText(cleanText);
    await vectorStore.upsertResumeVector({
      resumeId: String(resumeDoc._id),
      candidateId: String(resumeDoc.candidateId),
      isAnalyzed: true,
      vector,
    });
    resumeDoc.isAnalyzed = true;
    resumeDoc.processingStatus = "completed";
    resumeDoc.processingError = "";
    resumeDoc.vectorUpdatedAt = new Date();
    resumeDoc.vectorStale = false;
    return true;
  }

  async function uploadResume({ candidateId, file, title = "" }) {
    if (!file || !file.buffer) {
      throw createHttpError(400, "Resume file is required", "file_required");
    }

    const validation = validateResumeUpload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      maxBytes: MAX_RESUME_UPLOAD_BYTES,
    });

    if (!validation.ok) {
      const status = validation.errorCode === "uploaded_file_too_large" ? 413 : 400;
      throw createHttpError(status, validation.message, validation.errorCode);
    }

    const resumeId = new mongoose.Types.ObjectId().toString();
    const objectKey = `${candidateId}/${resumeId}.${validation.detectedType}`;
    const bucket = MINIO_BUCKETS.RESUMES;

    await minioStorage.uploadObject({
      bucket,
      objectKey,
      buffer: file.buffer,
      contentType: file.mimetype || "application/octet-stream",
      metadata: { "x-amz-meta-candidate-id": String(candidateId) },
    });

    let rawText = "";
    let isAnalyzed = false;
    let processingStatus = "pending";
    let processingError = "";
    let vectorUpdatedAt = null;
    let queuedForRetry = false;

    try {
      rawText = await parsingClient.extractRawTextFromFile({
        buffer: file.buffer,
        originalname: file.originalname || `resume.${validation.detectedType}`,
        mimetype: file.mimetype || "application/octet-stream",
      });
      const vector = await embeddingClient.embedText(rawText);
      await vectorStore.upsertResumeVector({
        resumeId,
        candidateId,
        isAnalyzed: true,
        vector,
      });
      isAnalyzed = true;
      processingStatus = "completed";
      vectorUpdatedAt = new Date();
    } catch (err) {
      processingStatus = "pending";
      processingError = err?.message || "Worker processing deferred";
      queuedForRetry = true;
      await enqueueRetry({
        resumeId,
        candidateId: String(candidateId),
        bucket,
        objectKey,
        mimeType: file.mimetype || "application/octet-stream",
        attempt: 0,
        enqueuedAt: new Date().toISOString(),
      });
    }

    const created = await ResumeModel.create({
      _id: resumeId,
      candidateId: String(candidateId),
      title: String(title || file.originalname || "Uploaded Resume").trim(),
      fileName: file.originalname || `resume.${validation.detectedType}`,
      mimeType: file.mimetype || "application/octet-stream",
      fileSize: file.buffer.length,
      fileUrl: objectKey,
      storageBucket: bucket,
      rawText,
      rawTextHash: rawText ? sha256Text(rawText) : "",
      isAnalyzed,
      processingStatus,
      processingError,
      vectorUpdatedAt,
      vectorStale: !isAnalyzed,
    });

    return { resume: created, queuedForRetry };
  }

  async function listResumes({ candidateId }) {
    return ResumeModel.find({ candidateId: String(candidateId) }, null, { sort: { updatedAt: -1 } });
  }

  async function createBuilderResume({ candidateId, payload = {} }) {
    const rawText = buildTextFromParsedData(payload.parsedData, payload.rawText);
    const created = await ResumeModel.create({
      candidateId: String(candidateId),
      title: String(payload.title || "Builder Resume").trim(),
      template: payload.template || "modern",
      design: payload.design || {},
      parsedData: payload.parsedData || {},
      rawText,
      rawTextHash: rawText ? sha256Text(rawText) : "",
      isAnalyzed: false,
      processingStatus: rawText ? "pending" : "completed",
      vectorStale: Boolean(rawText),
    });

    if (rawText) {
      try {
        await syncVectorForResume(created, rawText);
        await created.save();
      } catch (err) {
        created.processingError = err?.message || "Embedding deferred";
        await created.save();
        await enqueueRetry({ resumeId: String(created._id), candidateId: String(candidateId), attempt: 0 });
      }
    }

    return created;
  }

  async function assertCanReadResume(resume, viewer) {
    const isOwner = String(resume.candidateId) === String(viewer.id);
    if (isOwner) return;

    if (hasAnyRole(viewer.role, [ROLES.TECH_STAFF, ROLES.PLATFORM_OWNER])) {
      return;
    }

    if (hasAnyRole(viewer.role, [ROLES.RECRUITER])) {
      const allowed = await canRecruiterAccessResume(viewer.id, String(resume._id), String(resume.candidateId));
      if (allowed) return;
    }

    throw createHttpError(403, "You do not have permission to access this resume", "forbidden_resume_access");
  }

  async function getResumeById({ resumeId, viewer }) {
    const resume = await ResumeModel.findById(resumeId);
    if (!resume) {
      throw createHttpError(404, "Resume not found", "resume_not_found");
    }
    await assertCanReadResume(resume, viewer);
    return resume;
  }

  async function getResumeInternal({ resumeId }) {
    const resume = await ResumeModel.findById(resumeId);
    if (!resume) {
      throw createHttpError(404, "Resume not found", "resume_not_found");
    }
    return resume;
  }

  async function updateResume({ resumeId, candidateId, payload = {} }) {
    const resume = await ResumeModel.findById(resumeId);
    if (!resume) {
      throw createHttpError(404, "Resume not found", "resume_not_found");
    }
    if (String(resume.candidateId) !== String(candidateId)) {
      throw createHttpError(403, "Forbidden resume update", "forbidden_resume_access");
    }

    const versions = Array.isArray(resume.versions) ? [...resume.versions] : [];
    versions.push({
      versionId: crypto.randomUUID(),
      savedAt: new Date(),
      title: resume.title,
      parsedData: resume.parsedData || {},
      builderData: resume.builderData || null,
      rawText: resume.rawText || "",
    });
    resume.versions = versions.slice(-20);

    if (payload.title !== undefined) resume.title = String(payload.title).trim();
    if (payload.template !== undefined) resume.template = payload.template;
    if (payload.design !== undefined) resume.design = payload.design;
    if (payload.parsedData !== undefined) resume.parsedData = payload.parsedData;
    if (payload.builderData !== undefined) resume.builderData = payload.builderData;
    if (payload.coverLetter !== undefined) resume.coverLetter = payload.coverLetter;
    if (payload.outreachMessage !== undefined) resume.outreachMessage = payload.outreachMessage;
    if (payload.restoredFromVersionId !== undefined) {
      resume.restoredFromVersionId = payload.restoredFromVersionId;
    }
    if (payload.restoredAt !== undefined) {
      resume.restoredAt = payload.restoredAt;
    }

    const nextRawText =
      buildTextFromParsedData(
        resume.parsedData,
        payload.rawText !== undefined ? payload.rawText : ""
      ) || buildTextFromBuilderData(resume.builderData);
    if (nextRawText) {
      resume.rawText = nextRawText;
      resume.rawTextHash = sha256Text(nextRawText);
    }

    // Mark stale before vector sync
    resume.vectorStale = true;
    await resume.save();

    if (resume.rawText) {
      try {
        await syncVectorForResume(resume, resume.rawText);
        await resume.save();
      } catch (err) {
        resume.processingError = err?.message || "Vector resync deferred";
        await resume.save();
        await enqueueRetry({ resumeId: String(resume._id), candidateId: String(candidateId), attempt: 0 });
      }
    }

    return resume;
  }

  async function deleteResume({ resumeId, candidateId }) {
    const resume = await ResumeModel.findById(resumeId);
    if (!resume) {
      throw createHttpError(404, "Resume not found", "resume_not_found");
    }
    if (String(resume.candidateId) !== String(candidateId)) {
      throw createHttpError(403, "Forbidden resume deletion", "forbidden_resume_access");
    }

    if (resume.fileUrl && minioStorage) {
      await minioStorage.deleteObject(resume.storageBucket || MINIO_BUCKETS.RESUMES, resume.fileUrl);
    }
    if (vectorStore) {
      await vectorStore.deleteResumeVector(String(resume._id));
    }
    await ResumeModel.deleteOne({ _id: resume._id });
    return { ok: true };
  }

  async function setMasterResume({ resumeId, candidateId }) {
    const resume = await ResumeModel.findById(resumeId);
    if (!resume) {
      throw createHttpError(404, "Resume not found", "resume_not_found");
    }
    if (String(resume.candidateId) !== String(candidateId)) {
      throw createHttpError(403, "Forbidden resume update", "forbidden_resume_access");
    }

    await ResumeModel.updateMany(
      { candidateId: String(candidateId), isMaster: true },
      { $set: { isMaster: false } }
    );
    resume.isMaster = true;
    await resume.save();
    return resume;
  }

  async function listVersions({ resumeId, candidateId }) {
    const resume = await ResumeModel.findById(resumeId);
    if (!resume) {
      throw createHttpError(404, "Resume not found", "resume_not_found");
    }
    if (String(resume.candidateId) !== String(candidateId)) {
      throw createHttpError(403, "Forbidden resume access", "forbidden_resume_access");
    }
    return resume.versions || [];
  }

  async function restoreVersion({ resumeId, candidateId, versionId }) {
    const resume = await ResumeModel.findById(resumeId);
    if (!resume) {
      throw createHttpError(404, "Resume not found", "resume_not_found");
    }
    if (String(resume.candidateId) !== String(candidateId)) {
      throw createHttpError(403, "Forbidden resume update", "forbidden_resume_access");
    }
    const target = (resume.versions || []).find((v) => v.versionId === versionId);
    if (!target) {
      throw createHttpError(404, "Version snapshot not found", "version_not_found");
    }

    return updateResume({
      resumeId,
      candidateId,
      payload: {
        title: target.title,
        parsedData: target.parsedData,
        builderData: target.builderData ?? resume.builderData,
        rawText: target.rawText,
        restoredFromVersionId: String(versionId),
        restoredAt: new Date(),
      },
    });
  }

  async function getDownloadAccess({ resumeId, viewer, stream = false }) {
    const resume = await ResumeModel.findById(resumeId);
    if (!resume) {
      throw createHttpError(404, "Resume not found", "resume_not_found");
    }

    await assertCanReadResume(resume, viewer);

    if (!resume.fileUrl) {
      throw createHttpError(404, "No uploaded binary file for this resume", "resume_file_not_found");
    }

    const bucket = resume.storageBucket || MINIO_BUCKETS.RESUMES;
    if (stream) {
      const buffer = await minioStorage.getObjectBuffer(bucket, resume.fileUrl);
      return {
        buffer,
        fileName: resume.fileName || "resume.pdf",
        mimeType: resume.mimeType || "application/pdf",
      };
    }

    const downloadUrl = await minioStorage.getPresignedDownloadUrl(
      bucket,
      resume.fileUrl,
      DEFAULT_PRESIGNED_TTL_SECONDS
    );

    return {
      downloadUrl,
      expiresInSeconds: DEFAULT_PRESIGNED_TTL_SECONDS,
      fileName: resume.fileName || "resume.pdf",
      mimeType: resume.mimeType || "application/pdf",
    };
  }

  async function getMasterResume({ candidateId }) {
    const list = await listResumes({ candidateId });
    if (!list || list.length === 0) {
      throw createHttpError(404, "No master resume found", "master_resume_not_found");
    }
    return list.find((r) => Boolean(r.isMaster)) || list[0];
  }

  async function retryProcessing({ resumeId, candidateId }) {
    const resume = await ResumeModel.findById(resumeId);
    if (!resume) {
      throw createHttpError(404, "Resume not found", "resume_not_found");
    }
    if (String(resume.candidateId) !== String(candidateId)) {
      throw createHttpError(403, "Forbidden resume update", "forbidden_resume_access");
    }
    if (resume.rawText) {
      await syncVectorForResume(resume, resume.rawText);
      await resume.save();
    }
    return resume;
  }

  return {
    uploadResume,
    listResumes,
    getMasterResume,
    createBuilderResume,
    getResumeById,
    getResumeInternal,
    updateResume,
    retryProcessing,
    deleteResume,
    setMasterResume,
    listVersions,
    restoreVersion,
    getDownloadAccess,
  };
}
