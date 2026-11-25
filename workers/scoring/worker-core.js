function clampWeight(value, fallback = 0.65) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

export function buildWorkerConfig(env = process.env) {
  const queueName = env.SCORING_QUEUE_NAME || "application_scoring_queue";
  const processingQueueName = env.SCORING_PROCESSING_QUEUE_NAME || `${queueName}_processing`;
  const retryBackoffBaseMs = Number.parseInt(env.SCORING_RETRY_BACKOFF_MS || "1000", 10);
  const retryBackoffMode = String(env.SCORING_RETRY_BACKOFF_MODE || "linear").trim().toLowerCase();
  const retryBackoffMaxMs = Number.parseInt(env.SCORING_RETRY_BACKOFF_MAX_MS || "10000", 10);
  const blmoveTimeoutSeconds = Number.parseInt(
    env.SCORING_QUEUE_BLMOVE_TIMEOUT || env.SCORING_QUEUE_BRPOP_TIMEOUT || "5",
    10
  );
  const visibilityTimeoutMs = Number.parseInt(env.SCORING_VISIBILITY_TIMEOUT_MS || "60000", 10);
  const recoveryIntervalMs = Number.parseInt(env.SCORING_RECOVERY_INTERVAL_MS || "60000", 10);
  const semanticWeight = clampWeight(env.HYBRID_SEMANTIC_WEIGHT, 0.65);

  return {
    queueName,
    processingQueueName,
    processingTimestampsKey: `${processingQueueName}:ts`,
    deadLetterQueueName: env.SCORING_DLQ_NAME || `${queueName}_dlq`,
    internalBaseUrl: env.BACKEND_INTERNAL_BASE_URL || "http://gateway-backend:3001/api/internal",
    workerToken: env.WORKER_INTERNAL_TOKEN || "dev-worker-token",
    brpopTimeoutSeconds: blmoveTimeoutSeconds,
    blmoveTimeoutSeconds,
    visibilityTimeoutMs: Number.isFinite(visibilityTimeoutMs) && visibilityTimeoutMs > 0 ? visibilityTimeoutMs : 60000,
    recoveryIntervalMs: Number.isFinite(recoveryIntervalMs) && recoveryIntervalMs > 0 ? recoveryIntervalMs : 60000,
    maxRetries: Number.parseInt(env.SCORING_QUEUE_MAX_RETRIES || "3", 10),
    retryBackoffBaseMs: Number.isFinite(retryBackoffBaseMs) ? retryBackoffBaseMs : 1000,
    retryBackoffMode: retryBackoffMode === "exponential" ? "exponential" : "linear",
    retryBackoffMaxMs: Number.isFinite(retryBackoffMaxMs) ? retryBackoffMaxMs : 10000,
    semanticWeight,
    keywordWeight: Number((1 - semanticWeight).toFixed(4)),
    scoredChannel: "APPLICATION_SCORED",
    configChannel: "CONFIG_UPDATED",
  };
}

/**
 * Live-updatable hybrid scoring weight state listening to CONFIG_UPDATED events.
 */
export function createWeightState(initialSemanticWeight = 0.65) {
  let semanticWeight = clampWeight(initialSemanticWeight, 0.65);
  let keywordWeight = Number((1 - semanticWeight).toFixed(4));

  function applyConfigUpdate(payload = {}) {
    if (!payload || typeof payload !== "object") return getWeights();
    const candidate =
      payload?.scoringWeights?.semanticWeight ??
      payload?.scoring_weights?.semantic_weight ??
      payload?.semanticWeight ??
      payload?.semantic_weight;

    if (candidate !== undefined && candidate !== null) {
      semanticWeight = clampWeight(candidate, semanticWeight);
      keywordWeight = Number((1 - semanticWeight).toFixed(4));
    }
    return getWeights();
  }

  function getWeights() {
    return { semanticWeight, keywordWeight };
  }

  return { applyConfigUpdate, getWeights };
}

export function parsePayload(payloadText) {
  try {
    return JSON.parse(payloadText);
  } catch {
    return null;
  }
}

export function getRetryCount(payload) {
  const retryCount = Number.parseInt(String(payload?.retry_count ?? 0), 10);
  return Number.isFinite(retryCount) && retryCount >= 0 ? retryCount : 0;
}

export function classifyFailure(error) {
  const message = String(error?.message || "");
  if (/401\b|unauthorized/i.test(message)) {
    return "authorization_error";
  }
  if (/404\b|not found/i.test(message)) {
    return "resource_not_found";
  }
  if (/5\d\d\b|internal server error/i.test(message)) {
    return "internal_service_error";
  }
  if (/network|fetch|timeout|connect|econn/i.test(message)) {
    return "network_error";
  }

  return "processing_error";
}

export function getRetryBackoffMs(config, retryCount) {
  const count = Math.max(0, Number(retryCount) || 0);
  const base = Math.max(0, Number(config.retryBackoffBaseMs) || 0);
  const max = Math.max(base, Number(config.retryBackoffMaxMs) || base);

  const raw =
    config.retryBackoffMode === "exponential" ? base * Math.pow(2, count) : base * (count + 1);

  return Math.min(max, Math.max(base, raw));
}

export function getProcessUrl(config, applicationId) {
  return `${config.internalBaseUrl}/applications/${encodeURIComponent(applicationId)}/process-ai`;
}

export function getMarkFailedUrl(config, applicationId) {
  return `${config.internalBaseUrl}/applications/${encodeURIComponent(applicationId)}/mark-failed`;
}

export async function processMessage(payload, config, fetchImpl = fetch, weights = null) {
  const applicationId = String(payload?.application_id || "").trim();
  if (!applicationId) {
    throw new Error("Message is missing application_id");
  }

  const semanticWeight = weights?.semanticWeight ?? config.semanticWeight ?? 0.65;
  const keywordWeight = weights?.keywordWeight ?? config.keywordWeight ?? 0.35;

  const response = await fetchImpl(getProcessUrl(config, applicationId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.workerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: "worker-scoring",
      retry_count: getRetryCount(payload),
      semantic_weight: semanticWeight,
      keyword_weight: keywordWeight,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Worker scoring request failed for ${applicationId}: ${response.status} ${body}`
    );
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function notifyApplicationFailed(applicationId, error, config, fetchImpl = fetch) {
  if (!applicationId) return;
  try {
    await fetchImpl(getMarkFailedUrl(config, applicationId), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.workerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "worker-scoring",
        error: String(error?.message || "Scoring failed after max retries"),
      }),
    });
  } catch {
    // Best effort: DLQ record is already persisted
  }
}

export async function enqueueRetryOrDlq(redis, payload, error, config, logger = console) {
  const retryCount = getRetryCount(payload);
  const failureType = classifyFailure(error);
  const nextPayload = {
    ...payload,
    retry_count: retryCount + 1,
    failure_type: failureType,
    last_error: String(error?.message || "unknown error"),
    last_failed_at: new Date().toISOString(),
  };

  if (retryCount < config.maxRetries) {
    await redis.rpush(config.queueName, JSON.stringify(nextPayload));
    logger.error("[worker-scoring] queued retry", {
      application_id: payload?.application_id,
      retry_count: nextPayload.retry_count,
      max_retries: config.maxRetries,
    });

    return {
      outcome: "retry",
      delayMs: getRetryBackoffMs(config, retryCount),
      payload: nextPayload,
    };
  }

  const deadLetterPayload = {
    ...nextPayload,
    dead_lettered_at: new Date().toISOString(),
  };

  await redis.lpush(config.deadLetterQueueName, JSON.stringify(deadLetterPayload));
  logger.error("[worker-scoring] dead-lettered message", {
    application_id: payload?.application_id,
    retry_count: nextPayload.retry_count,
    dead_letter_queue: config.deadLetterQueueName,
  });

  return {
    outcome: "dead-letter",
    delayMs: 0,
    payload: deadLetterPayload,
  };
}

/**
 * Reliable queue consumer using BLMOVE (atomic move to processing_queue),
 * LREM acknowledgment, APPLICATION_SCORED Pub/Sub event, and DLQ mark-failed callback.
 */
export async function processQueueMessageOnce(
  redis,
  config,
  fetchImpl = fetch,
  logger = console,
  options = {}
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
    const result = await redis.brpop(config.queueName, config.brpopTimeoutSeconds);
    if (result && result.length >= 2) {
      payloadText = result[1];
    }
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

  const weights = options?.weightState ? options.weightState.getWeights() : null;

  try {
    const result = await processMessage(payload, config, fetchImpl, weights);

    if (typeof redis.publish === "function") {
      await redis.publish(
        config.scoredChannel || "APPLICATION_SCORED",
        JSON.stringify({
          application_id: payload.application_id,
          job_id: payload.job_id || null,
          resume_id: payload.resume_id || null,
          candidate_id: payload.candidate_id || null,
          ai_status: result?.data?.ai_status || "completed",
          scores: result?.data?.scores || null,
          published_at: new Date().toISOString(),
        })
      );
    }

    await ackProcessing();
    return { status: "processed", payload, result };
  } catch (error) {
    const retryResult = await enqueueRetryOrDlq(redis, payload, error, config, logger);
    if (retryResult.outcome === "dead-letter") {
      await notifyApplicationFailed(payload?.application_id, error, config, fetchImpl);
    }
    await ackProcessing();
    return {
      status: retryResult.outcome,
      payload: retryResult.payload,
      delayMs: retryResult.delayMs,
      error,
    };
  }
}

/**
 * Crash Recovery Loop: re-enqueue tasks stuck in processing_queue longer than visibilityTimeoutMs.
 */
export async function recoverStuckProcessingMessages(
  redis,
  config,
  nowMs = Date.now(),
  logger = console
) {
  if (typeof redis.lrange !== "function") {
    return { recovered: 0 };
  }

  const items = await redis.lrange(config.processingQueueName, 0, -1);
  if (!Array.isArray(items) || items.length === 0) {
    return { recovered: 0 };
  }

  const timestamps =
    typeof redis.hgetall === "function"
      ? (await redis.hgetall(config.processingTimestampsKey)) || {}
      : {};

  let recovered = 0;
  for (const rawPayload of items) {
    const startedAt = Number.parseInt(String(timestamps[rawPayload] || "0"), 10);
    const isExpired = !startedAt || nowMs - startedAt >= config.visibilityTimeoutMs;
    if (!isExpired) continue;

    await redis.lpush(config.queueName, rawPayload);
    if (typeof redis.lrem === "function") {
      await redis.lrem(config.processingQueueName, 1, rawPayload);
    }
    if (typeof redis.hdel === "function") {
      await redis.hdel(config.processingTimestampsKey, rawPayload);
    }
    recovered += 1;
    logger.warn?.("[worker-scoring] recovered stuck message from processing queue", {
      processing_queue: config.processingQueueName,
    });
  }

  return { recovered };
}
