import { createHttpError } from "@cvm/shared";

/**
 * Notification domain service: idempotency deduplication, MongoDB persistence,
 * instant SSE broadcast, Last-Event-ID replay, and self-contained email queue dispatch.
 */
export function createNotificationService({
  NotificationModel,
  sseHub,
  redisClient = null,
  emailQueueName = process.env.NOTIFICATION_QUEUE_NAME || "notification_queue",
} = {}) {
  async function createAndDispatch({
    userId,
    type,
    title,
    body,
    payload = {},
    idempotencyKey,
    emailTask = null,
  }) {
    const uid = String(userId || "").trim();
    const key = String(idempotencyKey || "").trim();
    if (!uid || !type || !key) {
      throw createHttpError(400, "userId, type, and idempotencyKey are required", "invalid_notification");
    }

    const existing = await NotificationModel.findOne({ idempotencyKey: key });
    if (existing) {
      return { deduplicated: true, notification: existing };
    }

    let created;
    try {
      created = await NotificationModel.create({
        userId: uid,
        type,
        title: String(title || "Notification"),
        body: String(body || ""),
        payload,
        idempotencyKey: key,
      });
    } catch (err) {
      if (err?.code === 11000) {
        const dupe = await NotificationModel.findOne({ idempotencyKey: key });
        return { deduplicated: true, notification: dupe };
      }
      throw err;
    }

    if (sseHub) {
      sseHub.pushToUser(uid, created);
    }

    if (emailTask && redisClient && typeof redisClient.lpush === "function") {
      await redisClient.lpush(
        emailQueueName,
        JSON.stringify({
          notification_id: String(created._id),
          type,
          user_id: uid,
          ...emailTask,
          retry_count: 0,
          enqueued_at: new Date().toISOString(),
        })
      );
    }

    return { deduplicated: false, notification: created };
  }

  async function listForUser({ userId, limit = 50 } = {}) {
    const safeLimit = Math.min(100, Math.max(1, Number.parseInt(String(limit), 10) || 50));
    const notifications = await NotificationModel.find(
      { userId: String(userId) },
      null,
      { sort: { createdAt: -1 }, limit: safeLimit }
    );
    return {
      notifications,
      data: notifications,
      pagination: {
        page: 1,
        limit: safeLimit,
        total: notifications.length,
        totalPages: 1,
      },
    };
  }

  async function getUnreadCount({ userId }) {
    const count = await NotificationModel.countDocuments({
      userId: String(userId),
      readAt: null,
    });
    const numeric = Number(count || 0);
    return { unread_count: numeric, count: numeric, data: { count: numeric } };
  }

  async function markRead({ notificationId, userId }) {
    const notif = await NotificationModel.findById(notificationId);
    if (!notif || String(notif.userId) !== String(userId)) {
      throw createHttpError(404, "Notification not found", "notification_not_found");
    }
    if (!notif.readAt) {
      notif.readAt = new Date();
      await notif.save();
    }
    return { notification: notif };
  }

  async function markAllRead({ userId }) {
    await NotificationModel.updateMany(
      { userId: String(userId), readAt: null },
      { $set: { readAt: new Date() } }
    );
    return { ok: true };
  }

  async function markEmailSent({ notificationId }) {
    const notif = await NotificationModel.findById(notificationId);
    if (!notif) {
      throw createHttpError(404, "Notification not found", "notification_not_found");
    }
    notif.emailSent = true;
    await notif.save();
    return { notification: notif };
  }

  async function getMissedSince({ userId, lastEventId }) {
    if (!lastEventId) return [];
    const uid = String(userId);
    const anchor = await NotificationModel.findById(String(lastEventId));
    if (!anchor || String(anchor.userId) !== uid) {
      return [];
    }

    const items = await NotificationModel.find(
      {
        userId: uid,
        createdAt: { $gt: anchor.createdAt },
      },
      null,
      { sort: { createdAt: 1 }, limit: 100 }
    );
    return items.filter((item) => String(item._id) !== String(lastEventId));
  }

  return {
    createAndDispatch,
    listForUser,
    getUnreadCount,
    markRead,
    markAllRead,
    markEmailSent,
    getMissedSince,
  };
}
