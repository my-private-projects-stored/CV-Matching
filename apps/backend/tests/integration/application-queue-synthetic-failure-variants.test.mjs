import test from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";

import Redis from "ioredis";

import {
  buildWorkerConfig,
  processQueueMessageOnce,
} from "../../../../workers/scoring/worker-core.js";

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "1";

function createConfig(baseEnv, queueName, dlqName) {
  return {
    ...buildWorkerConfig({
      ...baseEnv,
      SCORING_QUEUE_NAME: queueName,
      SCORING_DLQ_NAME: dlqName,
      SCORING_QUEUE_MAX_RETRIES: "1",
      SCORING_RETRY_BACKOFF_MODE: "linear",
      SCORING_RETRY_BACKOFF_MS: "1",
      SCORING_RETRY_BACKOFF_MAX_MS: "5",
    }),
    brpopTimeoutSeconds: 1,
  };
}

function buildFailResponseFetch(statusCode, bodyText) {
  return async function failResponseFetch() {
    return {
      ok: false,
      status: statusCode,
      text: async () => bodyText,
    };
  };
}

function buildThrowingFetch(message) {
  return async function throwingFetch() {
    throw new Error(message);
  };
}

async function runVariant(redis, {
  queueName,
  dlqName,
  loadCount,
  fetchImpl,
  expectedFailureType,
}) {
  const config = createConfig(process.env, queueName, dlqName);

  await redis.del(queueName);
  await redis.del(dlqName);

  for (let i = 0; i < loadCount; i += 1) {
    await redis.lpush(
      queueName,
      JSON.stringify({
        application_id: `${queueName}-app-${i}`,
        retry_count: config.maxRetries,
        enqueued_at: new Date().toISOString(),
      })
    );
  }

  const startedAt = Date.now();

  for (let i = 0; i < loadCount; i += 1) {
    const result = await processQueueMessageOnce(redis, config, fetchImpl, console);
    assert.equal(result.status, "dead-letter");
  }

  const elapsedMs = Date.now() - startedAt;
  const queueDepth = Number(await redis.llen(queueName));
  const dlqDepth = Number(await redis.llen(dlqName));
  assert.equal(queueDepth, 0);
  assert.equal(dlqDepth, loadCount);

  const sample = await redis.lindex(dlqName, 0);
  assert.ok(typeof sample === "string" && sample.length > 0);
  const samplePayload = JSON.parse(sample);
  assert.equal(samplePayload.failure_type, expectedFailureType);

  const throughputPerSecond = elapsedMs > 0 ? (loadCount * 1000) / elapsedMs : loadCount;

  await redis.del(queueName);
  await redis.del(dlqName);

  return {
    elapsedMs,
    throughputPerSecond,
  };
}

test(
  "queue synthetic variants: network failures vs internal failures produce distinct failure_type labels",
  { skip: !RUN_INTEGRATION },
  async () => {
    const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });

    const loadCount = 80;

    try {
      const networkVariant = await runVariant(redis, {
        queueName: `application_scoring_queue_network_variant_${Date.now()}`,
        dlqName: `application_scoring_queue_network_variant_${Date.now()}_dlq`,
        loadCount,
        fetchImpl: buildThrowingFetch("network timeout synthetic"),
        expectedFailureType: "network_error",
      });

      const internalVariant = await runVariant(redis, {
        queueName: `application_scoring_queue_internal_variant_${Date.now()}`,
        dlqName: `application_scoring_queue_internal_variant_${Date.now()}_dlq`,
        loadCount,
        fetchImpl: buildFailResponseFetch(503, "synthetic internal server error"),
        expectedFailureType: "internal_service_error",
      });

      assert.equal(Number.isFinite(networkVariant.throughputPerSecond), true);
      assert.equal(Number.isFinite(internalVariant.throughputPerSecond), true);
      assert.equal(networkVariant.throughputPerSecond > 0, true);
      assert.equal(internalVariant.throughputPerSecond > 0, true);
    } finally {
      redis.disconnect();
    }
  }
);
