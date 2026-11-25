import Redis from "ioredis";
import http from "node:http";
import { sendEmail, verifySmtpConnection, isConfigured as isSmtpConfigured } from "./mailer.js";
import {
  buildNotificationWorkerConfig,
  processNotificationQueueOnce,
  recoverStuckNotificationMessages,
} from "./worker-core.js";

const config = buildNotificationWorkerConfig(process.env);
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const METRICS_PORT = Number.parseInt(process.env.NOTIFICATION_METRICS_PORT || "0", 10);
const METRICS_LOG_INTERVAL_MS = Number.parseInt(
  process.env.NOTIFICATION_METRICS_LOG_INTERVAL_MS || "30000",
  10
);

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on("error", (err) => {
  console.error("[worker-notification] redis error", err.message);
});

const stats = {
  startedAt: new Date().toISOString(),
  processed: 0,
  retried: 0,
  deadLettered: 0,
  recovered: 0,
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

async function buildMetricsSnapshot() {
  const [queueDepth, processingDepth, dlqDepth] = await Promise.all([
    redis.llen(config.queueName),
    redis.llen(config.processingQueueName),
    redis.llen(config.deadLetterQueueName),
  ]);

  return {
    started_at: stats.startedAt,
    last_event_at: stats.lastEventAt,
    smtp_configured: isSmtpConfigured(),
    queue_name: config.queueName,
    queue_depth: Number(queueDepth || 0),
    processing_queue_name: config.processingQueueName,
    processing_depth: Number(processingDepth || 0),
    dlq_name: config.deadLetterQueueName,
    dlq_depth: Number(dlqDepth || 0),
    stats,
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
        res.end(JSON.stringify({ message: "Failed to collect metrics", error: String(error?.message) }));
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

setInterval(() => {
  buildMetricsSnapshot()
    .then((snapshot) => console.log("[worker-notification] heartbeat", snapshot))
    .catch((err) => console.error("[worker-notification] heartbeat error", err));
}, Math.max(1000, Number.isFinite(METRICS_LOG_INTERVAL_MS) ? METRICS_LOG_INTERVAL_MS : 30000));

setInterval(() => {
  recoverStuckNotificationMessages(redis, config, Date.now(), console)
    .then(({ recovered }) => {
      if (recovered > 0) stats.recovered += recovered;
    })
    .catch((err) => console.error("[worker-notification] recovery error", err));
}, Math.max(5000, config.recoveryIntervalMs));

async function run() {
  if (isSmtpConfigured()) {
    await verifySmtpConnection();
  } else {
    console.warn("[worker-notification] SMTP not configured — running in log-only mode");
  }

  startMetricsServer();
  await recoverStuckNotificationMessages(redis, config, Date.now(), console);

  let legacyResolver = null;
  if (config.legacyDirectMongo) {
    const dbMod = await import("./db.js");
    await dbMod.connectDb();
    legacyResolver = async (payload) => dbMod.getApplicationContext(payload.application_id);
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const outcome = await processNotificationQueueOnce(redis, config, {
        sendEmailImpl: sendEmail,
        fetchImpl: fetch,
        logger: console,
        legacyResolver,
      });

      if (outcome.status === "processed") {
        stats.processed += 1;
        if (outcome.result?.delivered) stats.emailsSent += 1;
        else if (outcome.result?.skipped) stats.emailsSkipped += 1;
        markEvent();
      } else if (outcome.status === "retry") {
        stats.retried += 1;
        stats.emailsFailed += 1;
        markEvent();
      } else if (outcome.status === "dead-letter") {
        stats.deadLettered += 1;
        stats.emailsFailed += 1;
        markEvent();
      } else if (outcome.status === "invalid-payload") {
        stats.invalidPayload += 1;
        markEvent();
      } else if (outcome.status === "empty") {
        stats.emptyPoll += 1;
      }
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
