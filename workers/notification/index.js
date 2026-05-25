import Redis from "ioredis";
import http from "node:http";

import { connectDb, getApplicationContext, getCandidatesForJob, markNotificationEmailSent } from "./db.js";
import { sendEmail, verifySmtpConnection, isConfigured as isSmtpConfigured } from "./mailer.js";
import {
  buildStatusChangedEmail,
  buildAiScoringCompletedEmail,
  buildJobClosedEmail,
} from "./templates.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const QUEUE_NAME = process.env.NOTIFICATION_QUEUE_NAME || "notification_queue";
const DLQ_NAME = process.env.NOTIFICATION_DLQ_NAME || `${QUEUE_NAME}_dlq`;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const BRPOP_TIMEOUT_S = Number.parseInt(process.env.NOTIFICATION_BRPOP_TIMEOUT || "5", 10);
const MAX_RETRIES = Number.parseInt(process.env.NOTIFICATION_MAX_RETRIES || "3", 10);
const METRICS_PORT = Number.parseInt(process.env.NOTIFICATION_METRICS_PORT || "0", 10);
const METRICS_LOG_INTERVAL_MS = Number.parseInt(
  process.env.NOTIFICATION_METRICS_LOG_INTERVAL_MS || "30000",
  10
);

// ---------------------------------------------------------------------------
// Redis
// ---------------------------------------------------------------------------

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on("error", (err) => {
  console.error("[worker-notification] redis error", err.message);
});

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

const stats = {
  startedAt: new Date().toISOString(),
  processed: 0,
  retried: 0,
  deadLettered: 0,
  invalidPayload: 0,
  emptyPoll: 0,
  loopErrors: 0,
  emailsSent: 0,
  emailsFailed: 0,
  emailsSkipped: 0,
  lastEventAt: null,
};

function markEvent() {
  stats.lastEventAt = new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Notification Handlers
// ---------------------------------------------------------------------------

/**
 * Notify candidate when recruiter changes their application status.
 *
 * Required payload fields:
 *   - application_id: string
 *   - from_status?: string
 *   - to_status: string
 */
async function handleApplicationStatusChanged(payload) {
  const applicationId = String(payload?.application_id || "").trim();
  if (!applicationId) {
    console.warn("[worker-notification] application_status_changed: missing application_id");
    return;
  }

  const ctx = await getApplicationContext(applicationId);
  if (!ctx) {
    console.warn("[worker-notification] application_status_changed: context not found", { applicationId });
    return;
  }

  if (!ctx.candidateEmail) {
    console.warn("[worker-notification] application_status_changed: candidate email missing", { applicationId });
    return;
  }

  const fromStatus = String(payload?.from_status || ctx.status || "").trim() || undefined;
  const toStatus = String(payload?.to_status || ctx.status || "new").trim();

  const { subject, html } = buildStatusChangedEmail({
    candidateName: ctx.candidateName,
    jobTitle: ctx.jobTitle,
    jobLocation: ctx.jobLocation,
    fromStatus,
    toStatus,
    applicationId,
  });

  const result = await sendEmail({ to: ctx.candidateEmail, subject, html });
  if (result.delivered) {
    stats.emailsSent += 1;
    await markNotificationEmailSent(payload?.notification_id);
  } else if (result.reason === "smtp_not_configured") {
    stats.emailsSkipped += 1;
  } else {
    stats.emailsFailed += 1;
  }

  console.log("[worker-notification] application_status_changed handled", {
    applicationId,
    to: ctx.candidateEmail,
    toStatus,
    delivered: result.delivered,
  });
}

/**
 * Notify candidate when AI scoring pipeline completes.
 *
 * Required payload fields:
 *   - application_id: string
 */
async function handleAiScoringCompleted(payload) {
  const applicationId = String(payload?.application_id || "").trim();
  if (!applicationId) {
    console.warn("[worker-notification] ai_scoring_completed: missing application_id");
    return;
  }

  const ctx = await getApplicationContext(applicationId);
  if (!ctx) {
    console.warn("[worker-notification] ai_scoring_completed: context not found", { applicationId });
    return;
  }

  if (!ctx.candidateEmail) {
    console.warn("[worker-notification] ai_scoring_completed: candidate email missing", { applicationId });
    return;
  }

  const { subject, html } = buildAiScoringCompletedEmail({
    candidateName: ctx.candidateName,
    jobTitle: ctx.jobTitle,
    applicationId,
    aiScores: ctx.aiScores,
    aiDetails: ctx.aiDetails,
  });

  const result = await sendEmail({ to: ctx.candidateEmail, subject, html });
  if (result.delivered) {
    stats.emailsSent += 1;
    await markNotificationEmailSent(payload?.notification_id);
  } else if (result.reason === "smtp_not_configured") {
    stats.emailsSkipped += 1;
  } else {
    stats.emailsFailed += 1;
  }

  console.log("[worker-notification] ai_scoring_completed handled", {
    applicationId,
    to: ctx.candidateEmail,
    hybridScore: ctx.aiScores.hybridScore,
    delivered: result.delivered,
  });
}

/**
 * Notify all candidates with active applications when a job is closed.
 *
 * Required payload fields:
 *   - job_id: string
 *   - job_title?: string  (fallback if DB query slow)
 *   - job_location?: string
 */
async function handleJobClosed(payload) {
  const jobId = String(payload?.job_id || "").trim();
  if (!jobId) {
    console.warn("[worker-notification] job_closed: missing job_id");
    return;
  }

  const candidates = await getCandidatesForJob(jobId);
  if (!candidates.length) {
    console.log("[worker-notification] job_closed: no active candidates to notify", { jobId });
    return;
  }

  const jobTitle = String(payload?.job_title || "the position").trim();
  const jobLocation = String(payload?.job_location || "").trim();

  let sent = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const { subject, html } = buildJobClosedEmail({
      candidateName: candidate.candidateName,
      jobTitle,
      jobLocation,
    });

    const result = await sendEmail({ to: candidate.candidateEmail, subject, html });
    if (result.delivered) {
      sent += 1;
      stats.emailsSent += 1;
      await markNotificationEmailSent(payload?.notification_id);
    } else if (result.reason === "smtp_not_configured") {
      stats.emailsSkipped += 1;
      break; // SMTP not configured — no point continuing the loop
    } else {
      failed += 1;
      stats.emailsFailed += 1;
    }
  }

  console.log("[worker-notification] job_closed handled", {
    jobId,
    jobTitle,
    totalCandidates: candidates.length,
    emailsSent: sent,
    emailsFailed: failed,
  });
}

/**
 * Route a notification payload to the appropriate handler.
 */
async function handleNotification(payload) {
  const type = String(payload?.type || "").trim();

  switch (type) {
    case "application_status_changed":
      await handleApplicationStatusChanged(payload);
      break;

    case "ai_scoring_completed":
      await handleAiScoringCompleted(payload);
      break;

    case "job_closed":
      await handleJobClosed(payload);
      break;

    default:
      console.warn("[worker-notification] unknown notification type — discarding", { type, payload });
  }
}

// ---------------------------------------------------------------------------
// Queue Processing
// ---------------------------------------------------------------------------

function parsePayload(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getRetryCount(payload) {
  const count = Number.parseInt(String(payload?.retry_count ?? 0), 10);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

async function enqueueRetryOrDlq(payload, error) {
  const retryCount = getRetryCount(payload);
  const nextPayload = {
    ...payload,
    retry_count: retryCount + 1,
    last_error: String(error?.message || "unknown error"),
    last_failed_at: new Date().toISOString(),
  };

  if (retryCount < MAX_RETRIES) {
    await redis.rpush(QUEUE_NAME, JSON.stringify(nextPayload));
    stats.retried += 1;
    console.error("[worker-notification] queued retry", {
      type: payload?.type,
      retry_count: nextPayload.retry_count,
      max_retries: MAX_RETRIES,
    });
    return "retry";
  }

  await redis.lpush(
    DLQ_NAME,
    JSON.stringify({ ...nextPayload, dead_lettered_at: new Date().toISOString() })
  );
  stats.deadLettered += 1;
  console.error("[worker-notification] dead-lettered message", {
    type: payload?.type,
    retry_count: nextPayload.retry_count,
    dlq: DLQ_NAME,
  });
  return "dead-letter";
}

async function processOnce() {
  const result = await redis.brpop(QUEUE_NAME, BRPOP_TIMEOUT_S);
  if (!result || result.length < 2) {
    stats.emptyPoll += 1;
    return "empty";
  }

  const payload = parsePayload(result[1]);
  if (!payload) {
    stats.invalidPayload += 1;
    console.warn("[worker-notification] invalid JSON payload — discarding");
    return "invalid-payload";
  }

  try {
    await handleNotification(payload);
    stats.processed += 1;
    markEvent();
    return "processed";
  } catch (error) {
    markEvent();
    return enqueueRetryOrDlq(payload, error);
  }
}

// ---------------------------------------------------------------------------
// Metrics HTTP Server
// ---------------------------------------------------------------------------

async function buildMetricsSnapshot() {
  const [queueDepth, dlqDepth] = await Promise.all([
    redis.llen(QUEUE_NAME),
    redis.llen(DLQ_NAME),
  ]);

  return {
    started_at: stats.startedAt,
    last_event_at: stats.lastEventAt,
    smtp_configured: isSmtpConfigured(),
    queue_name: QUEUE_NAME,
    queue_depth: Number(queueDepth || 0),
    dlq_name: DLQ_NAME,
    dlq_depth: Number(dlqDepth || 0),
    stats: {
      processed: stats.processed,
      retried: stats.retried,
      dead_lettered: stats.deadLettered,
      invalid_payload: stats.invalidPayload,
      empty_poll: stats.emptyPoll,
      loop_errors: stats.loopErrors,
      emails_sent: stats.emailsSent,
      emails_failed: stats.emailsFailed,
      emails_skipped: stats.emailsSkipped,
    },
  };
}

function startMetricsServer() {
  if (!Number.isFinite(METRICS_PORT) || METRICS_PORT <= 0) return null;

  const server = http.createServer(async (req, res) => {
    const url = String(req.url || "");

    if (req.method === "GET" && url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", smtp_configured: isSmtpConfigured() }));
      return;
    }

    if (req.method === "GET" && url === "/metrics") {
      try {
        const snapshot = await buildMetricsSnapshot();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(snapshot));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ message: "Failed to collect metrics", error: String(error?.message) })
        );
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Not found" }));
  });

  server.listen(METRICS_PORT, "0.0.0.0", () => {
    console.log("[worker-notification] metrics endpoint listening", { port: METRICS_PORT });
  });

  return server;
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

setInterval(async () => {
  try {
    const snapshot = await buildMetricsSnapshot();
    console.log("[worker-notification] heartbeat", snapshot);
  } catch (error) {
    console.error("[worker-notification] heartbeat error", error);
  }
}, Math.max(1000, Number.isFinite(METRICS_LOG_INTERVAL_MS) ? METRICS_LOG_INTERVAL_MS : 30000));

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function startup() {
  console.log("[worker-notification] starting", {
    queue: QUEUE_NAME,
    dlq: DLQ_NAME,
    redis: REDIS_URL,
    max_retries: MAX_RETRIES,
    smtp_configured: isSmtpConfigured(),
  });

  // Connect MongoDB
  await connectDb();

  // Verify SMTP (non-blocking — just log result)
  if (isSmtpConfigured()) {
    const smtpCheck = await verifySmtpConnection();
    if (smtpCheck.ok) {
      console.log("[worker-notification] SMTP connection verified ✓");
    } else {
      console.warn("[worker-notification] SMTP connection failed — emails will fail at send time", {
        reason: smtpCheck.reason,
      });
    }
  } else {
    console.warn(
      "[worker-notification] SMTP not configured (SMTP_HOST not set) — emails will be skipped (no-op mode)"
    );
  }

  startMetricsServer();
}

// ---------------------------------------------------------------------------
// Main Loop
// ---------------------------------------------------------------------------

async function run() {
  await startup();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await processOnce();
    } catch (error) {
      stats.loopErrors += 1;
      markEvent();
      console.error("[worker-notification] loop error", error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

run().catch((error) => {
  console.error("[worker-notification] fatal error", error);
  process.exit(1);
});
