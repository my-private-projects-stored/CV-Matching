import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

import "dotenv/config";

import Redis from "ioredis";

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "1";

async function getAvailablePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address !== "object") {
        reject(new Error("Failed to acquire dynamic port"));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

async function waitForJson(url, timeoutMs = 10000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Worker might still be booting.
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for endpoint: ${url}`);
}

async function stopChildProcess(child) {
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }

  child.kill();

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 2000);

    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

test(
  "worker metrics endpoint: exposes health and queue counters",
  { skip: !RUN_INTEGRATION },
  async () => {
    const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });

    const queueName = `application_scoring_queue_metrics_test_${Date.now()}`;
    const dlqName = `${queueName}_dlq`;
    const metricsPort = await getAvailablePort();

    const workerEntry = path.resolve(process.cwd(), "..", "..", "workers", "scoring", "index.js");
    const workerCwd = path.dirname(workerEntry);

    let stderr = "";
    const worker = spawn(process.execPath, [workerEntry], {
      cwd: workerCwd,
      env: {
        ...process.env,
        REDIS_URL: redisUrl,
        SCORING_QUEUE_NAME: queueName,
        SCORING_DLQ_NAME: dlqName,
        SCORING_METRICS_PORT: String(metricsPort),
        SCORING_METRICS_LOG_INTERVAL_MS: "5000",
        SCORING_QUEUE_BRPOP_TIMEOUT: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    worker.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    try {
      await redis.del(queueName);
      await redis.del(dlqName);

      const health = await waitForJson(`http://127.0.0.1:${metricsPort}/health`);
      assert.equal(health.status, "ok");

      const metrics = await waitForJson(`http://127.0.0.1:${metricsPort}/metrics`);
      assert.equal(metrics.queue_name, queueName);
      assert.equal(metrics.dlq_name, dlqName);
      assert.equal(typeof metrics.queue_depth, "number");
      assert.equal(typeof metrics.dlq_depth, "number");
      assert.equal(typeof metrics.started_at, "string");
      assert.equal(typeof metrics.stats, "object");
      assert.equal(typeof metrics.stats.processed, "number");
      assert.equal(typeof metrics.stats.retried, "number");
      assert.equal(typeof metrics.stats.dead_lettered, "number");
    } finally {
      await stopChildProcess(worker);

      await redis.del(queueName);
      await redis.del(dlqName);
      redis.disconnect();
    }

    assert.equal(worker.exitCode === null || worker.exitCode === 0, true, stderr);
  }
);
