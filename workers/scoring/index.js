import Redis from "ioredis";
import http from "node:http";
import {
  buildWorkerConfig,
  createWeightState,
  processQueueMessageOnce,
  recoverStuckProcessingMessages,
} from "./worker-core.js";

const config = buildWorkerConfig(process.env);
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const metricsLogIntervalMs = Number.parseInt(
  process.env.SCORING_METRICS_LOG_INTERVAL_MS || "30000",
  10
);
const metricsPort = Number.parseInt(process.env.SCORING_METRICS_PORT || "0", 10);

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

const subscriber = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

const weightState = createWeightState(config.semanticWeight);

subscriber.subscribe(config.configChannel).catch((err) => {
  console.error("[worker-scoring] Failed to subscribe CONFIG_UPDATED:", err.message);
});

subscriber.on("message", (channel, rawMessage) => {
  if (channel !== config.configChannel) return;
  try {
    const parsed = JSON.parse(rawMessage);
    const nextWeights = weightState.applyConfigUpdate(parsed);
    console.log("[worker-scoring] hot-reloaded hybrid weights", nextWeights);
  } catch {
    // Ignore malformed config update payload
  }
});

const workerStats = {
  startedAt: new Date().toISOString(),
  processed: 0,
  retried: 0,
  deadLettered: 0,
  recovered: 0,
  invalidPayload: 0,
  emptyPoll: 0,
  loopErrors: 0,
  lastEventAt: null,
};

function markEvent() {
  workerStats.lastEventAt = new Date().toISOString();
}

async function buildMetricsSnapshot() {
  const [queueDepth, processingDepth, dlqDepth] = await Promise.all([
    redis.llen(config.queueName),
    redis.llen(config.processingQueueName),
    redis.llen(config.deadLetterQueueName),
  ]);

  const weights = weightState.getWeights();

  return {
    started_at: workerStats.startedAt,
    last_event_at: workerStats.lastEventAt,
    queue_name: config.queueName,
    queue_depth: Number(queueDepth || 0),
    processing_queue_name: config.processingQueueName,
    processing_depth: Number(processingDepth || 0),
    dlq_name: config.deadLetterQueueName,
    dlq_depth: Number(dlqDepth || 0),
    weights,
    stats: {
      processed: workerStats.processed,
      retried: workerStats.retried,
      dead_lettered: workerStats.deadLettered,
      recovered: workerStats.recovered,
      invalid_payload: workerStats.invalidPayload,
      empty_poll: workerStats.emptyPoll,
      loop_errors: workerStats.loopErrors,
    },
  };
}

async function emitHeartbeat() {
  try {
    const snapshot = await buildMetricsSnapshot();
    console.log("[worker-scoring] heartbeat", snapshot);
  } catch (error) {
    console.error("[worker-scoring] heartbeat error", error);
  }
}

function startMetricsServer() {
  if (!Number.isFinite(metricsPort) || metricsPort <= 0) {
    return null;
  }

  const server = http.createServer(async (req, res) => {
    const url = String(req.url || "");

    if (req.method === "GET" && url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
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
          JSON.stringify({
            message: "Failed to collect worker metrics",
            error: String(error?.message || error),
          })
        );
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Not found" }));
  });

  server.listen(metricsPort, "0.0.0.0", () => {
    console.log("[worker-scoring] metrics endpoint listening", { port: metricsPort });
  });

  return server;
}

setInterval(() => {
  emitHeartbeat().catch((error) => {
    console.error("[worker-scoring] heartbeat fatal", error);
  });
}, Math.max(1000, Number.isFinite(metricsLogIntervalMs) ? metricsLogIntervalMs : 30000));

setInterval(() => {
  recoverStuckProcessingMessages(redis, config, Date.now(), console)
    .then(({ recovered }) => {
      if (recovered > 0) {
        workerStats.recovered += recovered;
        markEvent();
      }
    })
    .catch((error) => {
      console.error("[worker-scoring] recovery loop error", error);
    });
}, Math.max(5000, config.recoveryIntervalMs));

startMetricsServer();

async function run() {
  try {
    const startupRecovery = await recoverStuckProcessingMessages(redis, config, Date.now(), console);
    if (startupRecovery.recovered > 0) {
      workerStats.recovered += startupRecovery.recovered;
    }
  } catch (err) {
    console.error("[worker-scoring] startup recovery error", err.message);
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const result = await processQueueMessageOnce(redis, config, fetch, console, { weightState });
      if (result.status === "processed") {
        workerStats.processed += 1;
        markEvent();
      } else if (result.status === "retry") {
        workerStats.retried += 1;
        markEvent();
      } else if (result.status === "dead-letter") {
        workerStats.deadLettered += 1;
        markEvent();
      } else if (result.status === "invalid-payload") {
        workerStats.invalidPayload += 1;
        markEvent();
      } else if (result.status === "empty") {
        workerStats.emptyPoll += 1;
      }

      if (result.status === "retry" && Number(result.delayMs || 0) > 0) {
        await new Promise((resolve) => setTimeout(resolve, result.delayMs));
      }
    } catch (error) {
      workerStats.loopErrors += 1;
      markEvent();
      console.error("[worker-scoring] processing error", error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

run().catch((error) => {
  console.error("[worker-scoring] fatal error", error);
  process.exit(1);
});
