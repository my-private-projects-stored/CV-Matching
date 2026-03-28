import test from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";

import Redis from "ioredis";

import {
  buildWorkerConfig,
  processQueueMessageOnce,
} from "../../../../workers/scoring/worker-core.js";

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "1";

function parseLoadTiers(value) {
  const raw = String(value || "")
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((count) => Number.isFinite(count) && count > 0);

  const unique = Array.from(new Set(raw));
  return unique.length > 0 ? unique : [50, 200, 500];
}

function parseBaselineTpsMap(value) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(String(value));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const out = {};
    for (const [key, raw] of Object.entries(parsed)) {
      const tier = Number.parseInt(String(key), 10);
      const tps = Number(raw);
      if (Number.isFinite(tier) && tier > 0 && Number.isFinite(tps) && tps > 0) {
        out[tier] = tps;
      }
    }

    return out;
  } catch {
    return {};
  }
}

function buildSyntheticFetch(statusCode = 503, bodyText = "synthetic worker failure") {
  return async function syntheticFetch() {
    return {
      ok: false,
      status: statusCode,
      text: async () => bodyText,
    };
  };
}

test(
  "queue synthetic load: sustained failures are dead-lettered across multiple load tiers",
  { skip: !RUN_INTEGRATION },
  async () => {
    const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });

    const loadTiers = parseLoadTiers(process.env.SCORING_SYNTHETIC_LOAD_TIERS);
    const baselineTpsByTier = parseBaselineTpsMap(process.env.SCORING_SYNTHETIC_BASELINE_TPS_JSON);
    const maxDropPctRaw = Number.parseFloat(process.env.SCORING_SYNTHETIC_MAX_DROP_PCT || "0");
    const maxDropPct = Number.isFinite(maxDropPctRaw)
      ? Math.min(100, Math.max(0, maxDropPctRaw))
      : 0;
    const baselineExceptionMode = String(
      process.env.SCORING_SYNTHETIC_BASELINE_EXCEPTION_MODE || "enforce"
    )
      .trim()
      .toLowerCase();
    const baselineExceptionReason = String(
      process.env.SCORING_SYNTHETIC_BASELINE_EXCEPTION_REASON || ""
    ).trim();

    const throughputSnapshot = [];
    let baselineWarningCount = 0;

    try {
      for (const loadCount of loadTiers) {
        const queueName = `application_scoring_queue_synthetic_${loadCount}_${Date.now()}`;
        const dlqName = `${queueName}_dlq`;
        const config = {
          ...buildWorkerConfig({
            ...process.env,
            SCORING_QUEUE_NAME: queueName,
            SCORING_DLQ_NAME: dlqName,
            SCORING_QUEUE_MAX_RETRIES: "2",
            SCORING_RETRY_BACKOFF_MODE: "linear",
            SCORING_RETRY_BACKOFF_MS: "1",
            SCORING_RETRY_BACKOFF_MAX_MS: "5",
          }),
          brpopTimeoutSeconds: 1,
        };

        await redis.del(queueName);
        await redis.del(dlqName);

        for (let i = 0; i < loadCount; i += 1) {
          await redis.lpush(
            queueName,
            JSON.stringify({
              application_id: `synthetic-app-${loadCount}-${i}`,
              retry_count: config.maxRetries,
              enqueued_at: new Date().toISOString(),
            })
          );
        }

        const initialQueueDepth = Number(await redis.llen(queueName));
        assert.equal(initialQueueDepth, loadCount);

        const syntheticFetch = buildSyntheticFetch(503, "synthetic internal server error");
        const startedAt = Date.now();

        for (let i = 0; i < loadCount; i += 1) {
          const outcome = await processQueueMessageOnce(redis, config, syntheticFetch, console);
          assert.equal(outcome.status, "dead-letter");
        }

        const elapsedMs = Date.now() - startedAt;

        const queueDepthAfter = Number(await redis.llen(queueName));
        const dlqDepthAfter = Number(await redis.llen(dlqName));
        assert.equal(queueDepthAfter, 0);
        assert.equal(dlqDepthAfter, loadCount);

        const dlqSampleRaw = await redis.lindex(dlqName, 0);
        assert.ok(typeof dlqSampleRaw === "string" && dlqSampleRaw.length > 0);

        const dlqSample = JSON.parse(dlqSampleRaw);
        assert.equal(dlqSample.retry_count, config.maxRetries + 1);
        assert.equal(dlqSample.failure_type, "internal_service_error");

        const throughputPerSecond = elapsedMs > 0 ? (loadCount * 1000) / elapsedMs : loadCount;
        assert.equal(Number.isFinite(throughputPerSecond), true);
        assert.equal(throughputPerSecond > 0, true);

        const baselineTps = Number(baselineTpsByTier[loadCount] || 0);
        if (baselineTps > 0) {
          const minimumAllowed = baselineTps * (1 - maxDropPct / 100);
          const meetsThreshold = throughputPerSecond >= minimumAllowed;

          if (!meetsThreshold && baselineExceptionMode === "warn") {
            baselineWarningCount += 1;
            console.warn("[queue-synthetic-load] baseline regression warning", {
              load_count: loadCount,
              measured_tps: throughputPerSecond,
              baseline_tps: baselineTps,
              max_drop_pct: maxDropPct,
              exception_mode: baselineExceptionMode,
              exception_reason: baselineExceptionReason || null,
            });
          } else {
            assert.equal(
              meetsThreshold,
              true,
              `Throughput regression for tier ${loadCount}: measured=${throughputPerSecond.toFixed(
                2
              )} baseline=${baselineTps.toFixed(2)} max_drop_pct=${maxDropPct}`
            );
          }
        }

        throughputSnapshot.push({
          loadCount,
          elapsedMs,
          throughputPerSecond,
        });

        await redis.del(queueName);
        await redis.del(dlqName);
      }

      console.log("[queue-synthetic-load] throughput snapshot", throughputSnapshot);

      const snapshotRecord = {
        event: "queue_synthetic_load_throughput",
        timestamp_utc: new Date().toISOString(),
        load_tiers: loadTiers,
        baseline_exception_mode: baselineExceptionMode,
        baseline_warning_count: baselineWarningCount,
        snapshot: throughputSnapshot,
      };
      console.log("[queue-synthetic-load-json]", JSON.stringify(snapshotRecord));
    } finally {
      redis.disconnect();
    }
  }
);
