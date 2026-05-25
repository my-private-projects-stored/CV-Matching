import { apiFetch, apiPatch } from './client';
import { buildApiClientError } from './error';

async function assertOk(res: Response, fallbackMessagePrefix: string): Promise<void> {
  if (res.ok) return;
  const body = await res.text().catch(() => '');
  throw buildApiClientError(res.status, body, fallbackMessagePrefix);
}

export type NotificationType =
  | 'application_status_changed'
  | 'ai_scoring_completed'
  | 'job_closed';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  emailSent: boolean;
  createdAt: string;
}

export interface NotificationsListResponse {
  data: NotificationItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function normalizeNotification(raw: Record<string, unknown>): NotificationItem {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    type: String(raw.type ?? '') as NotificationType,
    title: String(raw.title ?? ''),
    body: String(raw.body ?? ''),
    payload: (raw.payload as Record<string, unknown>) ?? {},
    readAt: raw.read_at ? String(raw.read_at) : raw.readAt ? String(raw.readAt) : null,
    emailSent: Boolean(raw.email_sent ?? raw.emailSent),
    createdAt: String(raw.created_at ?? raw.createdAt ?? ''),
  };
}

export async function fetchNotifications(params?: {
  page?: number;
  limit?: number;
  unread?: boolean;
}): Promise<NotificationsListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.unread) query.set('unread', 'true');
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch(`/notifications${suffix}`);
  await assertOk(res, 'Failed to load notifications');
  const body = (await res.json()) as {
    data?: Record<string, unknown>[];
    pagination?: NotificationsListResponse['pagination'];
  };
  return {
    data: (body.data ?? []).map((item) => normalizeNotification(item)),
    pagination: body.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 },
  };
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await apiFetch('/notifications/unread-count');
  await assertOk(res, 'Failed to load unread count');
  const body = (await res.json()) as { data?: { count?: number }; count?: number };
  return Number(body.data?.count ?? body.count ?? 0);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const res = await apiPatch(`/notifications/${encodeURIComponent(notificationId)}/read`, {});
  await assertOk(res, 'Failed to mark notification as read');
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await apiPatch('/notifications/read-all', {});
  await assertOk(res, 'Failed to mark all notifications as read');
}
