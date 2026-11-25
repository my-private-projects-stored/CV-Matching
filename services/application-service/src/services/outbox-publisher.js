import { PUBSUB_CHANNELS } from "@cvm/shared";

/**
 * Background Outbox Publisher polling pending outbox_events and reliably dispatching
 * them to Redis queues (application_scoring_queue) or Pub/Sub (APPLICATION_STATUS_CHANGED).
 */
export function createOutboxPublisher({
  OutboxEventModel,
  redisClient = null,
  redisBus = null,
  scoringQueueName = process.env.SCORING_QUEUE_NAME || "application_scoring_queue",
  batchSize = 50,
  intervalMs = 500,
  maxAttempts = 20,
} = {}) {
  let timer = null;
  let running = false;

  async function publishEventDoc(event) {
    if (
      event.eventType === "APPLICATION_SUBMITTED" ||
      event.eventType === "APPLICATION_RETRY_SCORING"
    ) {
      if (!redisClient || typeof redisClient.lpush !== "function") {
        throw new Error("Redis client is not configured for scoring queue dispatch");
      }
      await redisClient.lpush(scoringQueueName, JSON.stringify(event.payload));
      return;
    }

    if (event.eventType === "APPLICATION_STATUS_CHANGED") {
      if (redisBus && typeof redisBus.publishEvent === "function") {
        await redisBus.publishEvent(PUBSUB_CHANNELS.APPLICATION_STATUS_CHANGED, event.payload);
      }
      return;
    }

    throw new Error(`Unsupported outbox eventType: ${event.eventType}`);
  }

  async function publishPendingOnce() {
    if (running) return { published: 0, failed: 0 };
    running = true;

    let published = 0;
    let failed = 0;

    try {
      const pending = await OutboxEventModel.find(
        { status: "pending" },
        null,
        { sort: { createdAt: 1 }, limit: batchSize }
      );

      for (const event of pending) {
        try {
          await publishEventDoc(event);
          event.status = "published";
          event.publishedAt = new Date();
          event.lastError = "";
          await event.save();
          published += 1;
        } catch (err) {
          event.attempts = Number(event.attempts || 0) + 1;
          event.lastError = String(err?.message || "Outbox dispatch failed");
          if (event.attempts >= maxAttempts) {
            event.status = "failed";
          }
          await event.save();
          failed += 1;
        }
      }

      return { published, failed };
    } finally {
      running = false;
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => {
      publishPendingOnce().catch((err) => {
        console.error("[outbox-publisher] error:", err?.message || err);
      });
    }, intervalMs);
    if (typeof timer.unref === "function") {
      timer.unref();
    }
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    publishPendingOnce,
    start,
    stop,
  };
}
