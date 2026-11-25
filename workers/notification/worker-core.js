import {
  buildAiScoringCompletedEmail,
  buildJobClosedEmail,
  buildStatusChangedEmail,
} from "./templates.js";

export function buildNotificationWorkerConfig(env = process.env) {
  const queueName = env.NOTIFICATION_QUEUE_NAME || "notification_queue";
  const processingQueueName = env.NOTIFICATION_PROCESSING_QUEUE_NAME || `${queueName}_processing`;
  const blmoveTimeoutSeconds = Number.parseInt(
    env.NOTIFICATION_BLMOVE_TIMEOUT || env.NOTIFICATION_BRPOP_TIMEOUT || "5",
    10
  );
  const visibilityTimeoutMs = Number.parseInt(env.NOTIFICATION_VISIBILITY_TIMEOUT_MS || "60000", 10);
  const recoveryIntervalMs = Number.parseInt(env.NOTIFICATION_RECOVERY_INTERVAL_MS || "60000", 10);

  return {
    queueName,
    processingQueueName,
    processingTimestampsKey: `${processingQueueName}:ts`,
    deadLetterQueueName: env.NOTIFICATION_DLQ_NAME || `${queueName}_dlq`,
    blmoveTimeoutSeconds,
    visibilityTimeoutMs: Number.isFinite(visibilityTimeoutMs) && visibilityTimeoutMs > 0 ? visibilityTimeoutMs : 60000,
    recoveryIntervalMs: Number.isFinite(recoveryIntervalMs) && recoveryIntervalMs > 0 ? recoveryIntervalMs : 60000,
    maxRetries: Number.parseInt(env.NOTIFICATION_MAX_RETRIES || "3", 10),
    notificationInternalBaseUrl:
      env.NOTIFICATION_INTERNAL_BASE_URL || "http://notification-service:5007/internal",
    workerToken: env.WORKER_INTERNAL_TOKEN || "dev-worker-token",
    legacyDirectMongo: env.LEGACY_DIRECT_MONGO === "1",
  };
}

export function parsePayload(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function getRetryCount(payload) {
  const count = Number.parseInt(String(payload?.retry_count ?? 0), 10);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

export async function markNotificationEmailSentCallback(
  notificationId,
  config,
  fetchImpl = fetch
) {
  if (!notificationId || !config.notificationInternalBaseUrl) return;
  try {
    await fetchImpl(
      `${config.notificationInternalBaseUrl}/notifications/${encodeURIComponent(notificationId)}/email-sent`,
      {
        method: "POST",
        headers: {
          "x-internal-token": config.workerToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source: "worker-notification" }),
      }
    );
  } catch {
    // Best-effort callback
  }
}

export async function renderAndSendNotification(
  payload,
  { sendEmailImpl, legacyResolver = null, config, fetchImpl = fetch }
) {
  const type = String(payload?.type || "").trim();
  let recipientEmail = String(payload?.recipient_email || payload?.candidate_email || "").trim();
  let recipientName = String(payload?.recipient_name || payload?.candidate_name || "Candidate").trim();
  let jobTitle = String(payload?.job_title || "Target Position").trim();
  let jobLocation = String(payload?.job_location || "").trim();
  let aiScores = payload?.ai_scores || null;
  let aiDetails = payload?.ai_details || null;

  // Optional legacy fallback ONLY if LEGACY_DIRECT_MONGO=1 and self-contained fields are missing
  if (!recipientEmail && legacyResolver) {
    const ctx = await legacyResolver(payload);
    if (ctx) {
      recipientEmail = ctx.candidateEmail || "";
      recipientName = ctx.candidateName || recipientName;
      jobTitle = ctx.jobTitle || jobTitle;
      jobLocation = ctx.jobLocation || jobLocation;
      aiScores = aiScores || ctx.aiScores;
      aiDetails = aiDetails || ctx.aiDetails;
    }
  }

  if (!recipientEmail) {
    return { skipped: true, reason: "recipient_email_missing" };
  }

  let emailContent;
  if (type === "application_status_changed") {
    emailContent = buildStatusChangedEmail({
      candidateName: recipientName,
      jobTitle,
      jobLocation,
      fromStatus: payload?.from_status || undefined,
      toStatus: payload?.to_status || "updated",
      applicationId: payload?.application_id || "",
    });
  } else if (type === "ai_scoring_completed") {
    emailContent = buildAiScoringCompletedEmail({
      candidateName: recipientName,
      jobTitle,
      applicationId: payload?.application_id || "",
      aiScores: aiScores || { semanticScore: 0, keywordScore: 0, hybridScore: 0 },
      aiDetails: aiDetails || { matchedKeywords: [], missingKeywords: [] },
    });
  } else if (type === "job_closed") {
    emailContent = buildJobClosedEmail({
      candidateName: recipientName,
      jobTitle,
      jobLocation,
    });
  } else {
    return { skipped: true, reason: `unknown_type:${type}` };
  }

  const sendResult = await sendEmailImpl({
    to: recipientEmail,
    subject: emailContent.subject,
    html: emailContent.html,
  });

  if (sendResult.delivered) {
    await markNotificationEmailSentCallback(payload?.notification_id, config, fetchImpl);
    return { delivered: true };
  }

  if (sendResult.reason === "smtp_not_configured") {
    return { skipped: true, reason: "smtp_not_configured" };
  }

  throw new Error(sendResult.error || sendResult.reason || "Email delivery failed");
}

export async function enqueueRetryOrDlq(redis, payload, error, config, logger = console) {
  const retryCount = getRetryCount(payload);
  const nextPayload = {
    ...payload,
    retry_count: retryCount + 1,
    last_error: String(error?.message || "unknown error"),
    last_failed_at: new Date().toISOString(),
  };

  if (retryCount < config.maxRetries) {
    await redis.rpush(config.queueName, JSON.stringify(nextPayload));
    logger.error("[worker-notification] queued retry", {
      type: payload?.type,
      retry_count: nextPayload.retry_count,
    });
    return { outcome: "retry", payload: nextPayload };
  }

  const dlqPayload = {
    ...nextPayload,
    dead_lettered_at: new Date().toISOString(),
  };
  await redis.lpush(config.deadLetterQueueName, JSON.stringify(dlqPayload));
  logger.error("[worker-notification] dead-lettered message", {
    type: payload?.type,
    retry_count: nextPayload.retry_count,
    dlq: config.deadLetterQueueName,
  });
  return { outcome: "dead-letter", payload: dlqPayload };
}

/**
 * Reliable notification queue processor using BLMOVE + processing_queue + LREM + DLQ.
 * Fully decoupled from other microservices' MongoDB databases.
 */
export async function processNotificationQueueOnce(
  redis,
  config,
  { sendEmailImpl, fetchImpl = fetch, logger = console, legacyResolver = null } = {}
) {
  let payloadText = null;
  let movedToProcessing = false;

  if (typeof redis.blmove === "function") {
    payloadText = await redis.blmove(
      config.queueName,
      config.processingQueueName,
      "RIGHT",
      "LEFT",
      config.blmoveTimeoutSeconds
    );
    movedToProcessing = Boolean(payloadText);
  } else {
    const res = await redis.brpop(config.queueName, config.blmoveTimeoutSeconds);
    if (res && res.length >= 2) payloadText = res[1];
  }

  if (!payloadText) {
    return { status: "empty" };
  }

  if (movedToProcessing && typeof redis.hset === "function") {
    await redis.hset(config.processingTimestampsKey, payloadText, String(Date.now()));
  }

  async function ackProcessing() {
    if (!movedToProcessing) return;
    if (typeof redis.lrem === "function") {
      await redis.lrem(config.processingQueueName, 1, payloadText);
    }
    if (typeof redis.hdel === "function") {
      await redis.hdel(config.processingTimestampsKey, payloadText);
    }
  }

  const payload = parsePayload(payloadText);
  if (!payload) {
    await ackProcessing();
    return { status: "invalid-payload" };
  }

  try {
    const result = await renderAndSendNotification(payload, {
      sendEmailImpl,
      legacyResolver,
      config,
      fetchImpl,
    });
    await ackProcessing();
    return { status: "processed", result, payload };
  } catch (error) {
    const retryRes = await enqueueRetryOrDlq(redis, payload, error, config, logger);
    await ackProcessing();
    return { status: retryRes.outcome, payload: retryRes.payload, error };
  }
}

export async function recoverStuckNotificationMessages(
  redis,
  config,
  nowMs = Date.now(),
  logger = console
) {
  if (typeof redis.lrange !== "function") return { recovered: 0 };
  const items = await redis.lrange(config.processingQueueName, 0, -1);
  if (!Array.isArray(items) || items.length === 0) return { recovered: 0 };

  const timestamps =
    typeof redis.hgetall === "function"
      ? (await redis.hgetall(config.processingTimestampsKey)) || {}
      : {};

  let recovered = 0;
  for (const raw of items) {
    const startedAt = Number.parseInt(String(timestamps[raw] || "0"), 10);
    if (startedAt && nowMs - startedAt < config.visibilityTimeoutMs) continue;

    await redis.lpush(config.queueName, raw);
    if (typeof redis.lrem === "function") {
      await redis.lrem(config.processingQueueName, 1, raw);
    }
    if (typeof redis.hdel === "function") {
      await redis.hdel(config.processingTimestampsKey, raw);
    }
    recovered += 1;
    logger.warn?.("[worker-notification] recovered stuck notification message");
  }
  return { recovered };
}
