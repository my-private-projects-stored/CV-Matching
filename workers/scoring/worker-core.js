export function buildWorkerConfig(env = process.env) {
  const queueName = env.SCORING_QUEUE_NAME || "application_scoring_queue";
  const retryBackoffBaseMs = Number.parseInt(env.SCORING_RETRY_BACKOFF_MS || "1000", 10);
  const retryBackoffMode = String(env.SCORING_RETRY_BACKOFF_MODE || "linear").trim().toLowerCase();
  const retryBackoffMaxMs = Number.parseInt(env.SCORING_RETRY_BACKOFF_MAX_MS || "10000", 10);

  return {
    queueName,
    deadLetterQueueName: env.SCORING_DLQ_NAME || `${queueName}_dlq`,
    internalBaseUrl: env.BACKEND_INTERNAL_BASE_URL || "http://gateway-backend:3001/api/internal",
    workerToken: env.WORKER_INTERNAL_TOKEN || "dev-worker-token",
    brpopTimeoutSeconds: Number.parseInt(env.SCORING_QUEUE_BRPOP_TIMEOUT || "5", 10),
    maxRetries: Number.parseInt(env.SCORING_QUEUE_MAX_RETRIES || "3", 10),
    retryBackoffBaseMs: Number.isFinite(retryBackoffBaseMs) ? retryBackoffBaseMs : 1000,
    retryBackoffMode: retryBackoffMode === "exponential" ? "exponential" : "linear",
    retryBackoffMaxMs: Number.isFinite(retryBackoffMaxMs) ? retryBackoffMaxMs : 10000,
  };
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

export async function processMessage(payload, config, fetchImpl = fetch) {
  const applicationId = String(payload?.application_id || "").trim();
  if (!applicationId) {
    throw new Error("Message is missing application_id");
  }

  const response = await fetchImpl(getProcessUrl(config, applicationId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.workerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: "worker-scoring",
      retry_count: getRetryCount(payload),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Worker scoring request failed for ${applicationId}: ${response.status} ${body}`
    );
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

export async function processQueueMessageOnce(redis, config, fetchImpl = fetch, logger = console) {
  const result = await redis.brpop(config.queueName, config.brpopTimeoutSeconds);
  if (!result || result.length < 2) {
    return { status: "empty" };
  }

  const payloadText = result[1];
  const payload = parsePayload(payloadText);
  if (!payload) {
    return { status: "invalid-payload" };
  }

  try {
    await processMessage(payload, config, fetchImpl);
    return { status: "processed", payload };
  } catch (error) {
    const retryResult = await enqueueRetryOrDlq(redis, payload, error, config, logger);
    return {
      status: retryResult.outcome,
      payload: retryResult.payload,
      delayMs: retryResult.delayMs,
      error,
    };
  }
}
