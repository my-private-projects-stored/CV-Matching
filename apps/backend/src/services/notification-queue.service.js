import Redis from "ioredis";

import {
  persistAiScoringCompletedNotification,
  persistJobClosedNotifications,
  persistStatusChangedNotification,
} from "./notification.service.js";

function getQueueName() {
  return process.env.NOTIFICATION_QUEUE_NAME || "notification_queue";
}

function createRedisClient() {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const client = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    retryStrategy: () => null,
  });

  client.on("error", () => undefined);
  return client;
}

/**
 * Push a notification event onto the notification_queue for worker-notification to process.
 */
export async function enqueueNotification(type, data = {}) {
  const normalizedType = String(type || "").trim();
  if (!normalizedType) {
    throw new Error("notification type is required");
  }

  let notificationId = data.notification_id ? String(data.notification_id) : null;

  if (!notificationId) {
    if (normalizedType === "application_status_changed") {
      notificationId = await persistStatusChangedNotification({
        applicationId: data.application_id,
        fromStatus: data.from_status,
        toStatus: data.to_status,
      });
    } else if (normalizedType === "ai_scoring_completed") {
      notificationId = await persistAiScoringCompletedNotification({
        applicationId: data.application_id,
      });
    }
  }

  const payload = JSON.stringify({
    type: normalizedType,
    ...data,
    notification_id: notificationId || undefined,
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

  return notificationId;
}

export async function enqueueStatusChangedNotification({ applicationId, fromStatus, toStatus }) {
  const notificationId = await persistStatusChangedNotification({
    applicationId,
    fromStatus,
    toStatus,
  });

  return enqueueNotification("application_status_changed", {
    application_id: String(applicationId || "").trim(),
    from_status: fromStatus ? String(fromStatus).trim() : undefined,
    to_status: String(toStatus || "").trim(),
    notification_id: notificationId || undefined,
  });
}

export async function enqueueAiScoringCompletedNotification({ applicationId }) {
  const notificationId = await persistAiScoringCompletedNotification({ applicationId });

  return enqueueNotification("ai_scoring_completed", {
    application_id: String(applicationId || "").trim(),
    notification_id: notificationId || undefined,
  });
}

export async function enqueueJobClosedNotification({ jobId, jobTitle, jobLocation }) {
  const notificationIds = await persistJobClosedNotifications({ jobId, jobTitle, jobLocation });

  const client = createRedisClient();
  try {
    await client.connect();
    for (const notificationId of notificationIds) {
      const payload = JSON.stringify({
        type: "job_closed",
        job_id: String(jobId || "").trim(),
        job_title: jobTitle ? String(jobTitle).trim() : undefined,
        job_location: jobLocation ? String(jobLocation).trim() : undefined,
        notification_id: notificationId,
        enqueued_at: new Date().toISOString(),
        retry_count: 0,
      });
      await client.lpush(getQueueName(), payload);
    }
  } finally {
    client.disconnect();
  }
}
