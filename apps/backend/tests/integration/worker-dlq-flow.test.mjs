import test from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";

import Redis from "ioredis";
import mongoose from "mongoose";

import app from "../../src/app.js";
import {
  buildWorkerConfig,
  processQueueMessageOnce,
} from "../../../../workers/scoring/worker-core.js";

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "1";

function getTestMongoUri() {
  const mongoUri = process.env.MONGO_URI_TEST || process.env.MONGO_URI;
  assert.ok(mongoUri, "MONGO_URI is required for integration test");

  const url = new URL(mongoUri);
  const dbName = (url.pathname || "/cv_matching").replace(/^\//, "") || "cv_matching";
  url.pathname = `/${dbName}_worker_dlq_integration`;
  return url.toString();
}

test(
  "worker DLQ flow: failed internal processing is dead-lettered after retry limit",
  { skip: !RUN_INTEGRATION },
  async () => {
    const mongoUri = getTestMongoUri();
    await mongoose.connect(mongoUri);

    const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });

    const queueName = `application_scoring_queue_dlq_test_${Date.now()}`;
    const dlqName = `${queueName}_dlq`;

    const oldWorkerToken = process.env.WORKER_INTERNAL_TOKEN;
    process.env.WORKER_INTERNAL_TOKEN = "integration-worker-dlq-token";

    const server = app.listen(0);
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const internalBaseUrl = `http://127.0.0.1:${address.port}/api/internal`;

    const config = {
      ...buildWorkerConfig({
        ...process.env,
        SCORING_QUEUE_NAME: queueName,
        SCORING_DLQ_NAME: dlqName,
        BACKEND_INTERNAL_BASE_URL: internalBaseUrl,
        WORKER_INTERNAL_TOKEN: "integration-worker-dlq-token",
        SCORING_QUEUE_MAX_RETRIES: "3",
        SCORING_RETRY_BACKOFF_MODE: "linear",
        SCORING_RETRY_BACKOFF_MS: "10",
        SCORING_RETRY_BACKOFF_MAX_MS: "50",
      }),
      brpopTimeoutSeconds: 1,
    };

    try {
      await redis.del(queueName);
      await redis.del(dlqName);

      await redis.lpush(
        queueName,
        JSON.stringify({
          application_id: new mongoose.Types.ObjectId().toString(),
          retry_count: config.maxRetries,
          enqueued_at: new Date().toISOString(),
        })
      );

      const result = await processQueueMessageOnce(redis, config, fetch, console);
      assert.equal(result.status, "dead-letter");

      const dlqMessages = await redis.lrange(dlqName, 0, -1);
      assert.equal(dlqMessages.length, 1);

      const payload = JSON.parse(dlqMessages[0]);
      assert.equal(typeof payload.application_id, "string");
      assert.equal(payload.retry_count, config.maxRetries + 1);
      assert.equal(typeof payload.dead_lettered_at, "string");
      assert.equal(payload.dead_lettered_at.length > 0, true);
      assert.equal(typeof payload.last_error, "string");
      assert.equal(payload.last_error.includes("Worker scoring request failed"), true);
      assert.equal(typeof payload.failure_type, "string");
      assert.equal(payload.failure_type.length > 0, true);
    } finally {
      process.env.WORKER_INTERNAL_TOKEN = oldWorkerToken;

      await redis.del(queueName);
      await redis.del(dlqName);
      redis.disconnect();

      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
);
