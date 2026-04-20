import Redis from "ioredis";

function getQueueName() {
  return process.env.SCORING_QUEUE_NAME || "application_scoring_queue";
}

function createRedisClient() {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const client = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    retryStrategy: () => null,
  });

  // Keep enqueue path non-disruptive when Redis is unavailable in local/integration runs.
  client.on("error", () => undefined);
  return client;
}

export async function enqueueApplicationScoring(applicationId) {
  const id = String(applicationId || "").trim();
  if (!id) {
    throw new Error("applicationId is required");
  }

  const payload = JSON.stringify({
    application_id: id,
    enqueued_at: new Date().toISOString(),
    retry_count: 0,
  });

  const client = createRedisClient();
  try {
    await client.connect();
    await client.lpush(getQueueName(), payload);
  } finally {
    client.disconnect();
  }
}
