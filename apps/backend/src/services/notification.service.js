import Application from "../models/Application.js";
import Job from "../models/Job.js";
import Notification from "../models/Notification.js";
import Resume from "../models/Resume.js";
import User from "../models/User.js";

function normalizePagination(query = {}) {
  const page = Math.max(1, Number.parseInt(String(query.page || "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(query.limit || "20"), 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function toNotificationDto(doc) {
  return {
    id: String(doc._id),
    type: doc.type,
    title: doc.title,
    body: doc.body,
    payload: doc.payload || {},
    read_at: doc.readAt || null,
    email_sent: Boolean(doc.emailSent),
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

async function getApplicationContext(applicationId) {
  const app = await Application.findById(applicationId).lean();
  if (!app) return null;

  const resume = await Resume.findById(app.resumeId).select("candidateId title").lean();
  if (!resume) return null;

  const [candidate, job] = await Promise.all([
    User.findById(resume.candidateId).select("email fullName role").lean(),
    Job.findById(app.jobId).select("title location recruiterId status").lean(),
  ]);

  return {
    applicationId: String(app._id),
    candidateId: resume.candidateId ? String(resume.candidateId) : null,
    candidateName: candidate?.fullName || "Candidate",
    recruiterId: job?.recruiterId ? String(job.recruiterId) : null,
    jobId: app.jobId ? String(app.jobId) : null,
    jobTitle: job?.title || "the position",
    jobLocation: job?.location || "",
    status: String(app.status || ""),
    hybridScore: Number(app.aiScores?.hybridScore || 0),
  };
}

function buildStatusChangedCopy(ctx, fromStatus, toStatus) {
  const title = `Application status updated: ${toStatus}`;
  const body = `Your application for "${ctx.jobTitle}" moved from ${fromStatus || "previous"} to ${toStatus}.`;
  return { title, body };
}

function buildAiScoringCopy(ctx) {
  const score = Math.round(ctx.hybridScore * 100);
  const title = "AI scoring completed";
  const body = `Your match score for "${ctx.jobTitle}" is ready${Number.isFinite(score) ? ` (${score}%)` : ""}.`;
  return { title, body };
}

function buildJobClosedCopy(ctx) {
  const title = `Job closed: ${ctx.jobTitle}`;
  const body = `The position "${ctx.jobTitle}"${ctx.jobLocation ? ` in ${ctx.jobLocation}` : ""} is no longer accepting applications.`;
  return { title, body };
}

export async function createNotificationForUser({ userId, type, title, body, payload = {} }) {
  if (!userId) return null;
  return Notification.create({
    userId,
    type,
    title,
    body,
    payload,
    emailSent: false,
  });
}

export async function persistStatusChangedNotification({ applicationId, fromStatus, toStatus }) {
  const ctx = await getApplicationContext(applicationId);
  if (!ctx?.candidateId) return null;

  const copy = buildStatusChangedCopy(ctx, fromStatus, toStatus);
  const notification = await createNotificationForUser({
    userId: ctx.candidateId,
    type: "application_status_changed",
    title: copy.title,
    body: copy.body,
    payload: {
      application_id: ctx.applicationId,
      job_id: ctx.jobId,
      from_status: fromStatus || null,
      to_status: toStatus,
    },
  });

  return notification ? String(notification._id) : null;
}

export async function persistAiScoringCompletedNotification({ applicationId }) {
  const ctx = await getApplicationContext(applicationId);
  if (!ctx?.candidateId) return null;

  const copy = buildAiScoringCopy(ctx);
  const notification = await createNotificationForUser({
    userId: ctx.candidateId,
    type: "ai_scoring_completed",
    title: copy.title,
    body: copy.body,
    payload: {
      application_id: ctx.applicationId,
      job_id: ctx.jobId,
      hybrid_score: ctx.hybridScore,
    },
  });

  return notification ? String(notification._id) : null;
}

export async function persistJobClosedNotifications({ jobId, jobTitle, jobLocation }) {
  const apps = await Application.find({
    jobId,
    status: { $in: ["new", "screening", "interview"] },
  })
    .select("_id resumeId")
    .lean();

  const notificationIds = [];
  for (const app of apps) {
    const resume = await Resume.findById(app.resumeId).select("candidateId").lean();
    if (!resume?.candidateId) continue;

    const copy = buildJobClosedCopy({ jobTitle: jobTitle || "Position", jobLocation: jobLocation || "" });
    const notification = await createNotificationForUser({
      userId: resume.candidateId,
      type: "job_closed",
      title: copy.title,
      body: copy.body,
      payload: {
        application_id: String(app._id),
        job_id: String(jobId),
      },
    });
    if (notification) notificationIds.push(String(notification._id));
  }

  return notificationIds;
}

export async function markNotificationEmailSent(notificationId) {
  if (!notificationId) return;
  await Notification.findByIdAndUpdate(notificationId, { emailSent: true });
}

export async function listNotificationsForUser(userId, query = {}) {
  const { page, limit, skip } = normalizePagination(query);
  const filter = { userId };

  if (String(query.unread || "").toLowerCase() === "true") {
    filter.readAt = null;
  }

  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
  ]);

  return {
    data: items.map(toNotificationDto),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
}

export async function getUnreadCountForUser(userId) {
  return Notification.countDocuments({ userId, readAt: null });
}

export async function markNotificationReadForUser(userId, notificationId) {
  const updated = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { readAt: new Date() },
    { new: true }
  ).lean();

  if (!updated) {
    return { error: "Notification not found", code: 404 };
  }

  return { data: toNotificationDto(updated) };
}

export async function markAllNotificationsReadForUser(userId) {
  const result = await Notification.updateMany({ userId, readAt: null }, { readAt: new Date() });
  return { data: { updated: result.modifiedCount || 0 } };
}
