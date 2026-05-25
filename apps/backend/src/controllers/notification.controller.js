import {
  getUnreadCountForUser,
  listNotificationsForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
} from "../services/notification.service.js";

function requestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getAuthUserId(req) {
  return String(req.auth?.userId || "").trim();
}

export async function listNotificationsHandler(req, res, next) {
  try {
    const userId = getAuthUserId(req);
    const result = await listNotificationsForUser(userId, req.query);
    return res.status(200).json({ request_id: requestId(), ...result });
  } catch (error) {
    return next(error);
  }
}

export async function getUnreadCountHandler(req, res, next) {
  try {
    const userId = getAuthUserId(req);
    const count = await getUnreadCountForUser(userId);
    return res.status(200).json({ request_id: requestId(), data: { count } });
  } catch (error) {
    return next(error);
  }
}

export async function markNotificationReadHandler(req, res, next) {
  try {
    const userId = getAuthUserId(req);
    const result = await markNotificationReadForUser(userId, req.params.id);
    if (result.error) {
      return res.status(result.code || 404).json({ message: result.error });
    }
    return res.status(200).json({ request_id: requestId(), ...result });
  } catch (error) {
    return next(error);
  }
}

export async function markAllNotificationsReadHandler(req, res, next) {
  try {
    const userId = getAuthUserId(req);
    const result = await markAllNotificationsReadForUser(userId);
    return res.status(200).json({ request_id: requestId(), ...result });
  } catch (error) {
    return next(error);
  }
}
