import { apiFetch, apiPatch, apiPost } from './client';
import { buildApiClientError } from './error';
import type { User, UserRole } from '@/types';

async function assertOk(res: Response, fallbackMessagePrefix: string): Promise<void> {
  if (res.ok) return;
  const body = await res.text().catch(() => '');
  throw buildApiClientError(res.status, body, fallbackMessagePrefix);
}

export interface UserListResponse {
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function normalizeUser(raw: Record<string, unknown>): User {
  return {
    _id: String(raw._id ?? raw.id ?? ''),
    email: String(raw.email ?? ''),
    fullName: String(raw.fullName ?? raw.full_name ?? raw.name ?? ''),
    role: String(raw.role ?? 'candidate') as UserRole,
    disabled: Boolean(raw.disabled),
  };
}

export async function fetchUsers(params?: {
  role?: UserRole | '';
  page?: number;
  limit?: number;
}): Promise<UserListResponse> {
  const query = new URLSearchParams();
  if (params?.role) query.set('role', params.role);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch(`/users${suffix}`);
  await assertOk(res, 'Failed to load users');
  const body = (await res.json()) as {
    data?: Record<string, unknown>[];
    users?: Record<string, unknown>[];
    pagination?: { page?: number; limit?: number; total?: number; totalPages?: number };
  };
  const items = (body.data ?? body.users ?? []).map(normalizeUser);
  const total = Number(body.pagination?.total ?? items.length);
  const limit = Number(body.pagination?.limit ?? params?.limit ?? 50);
  return {
    data: items,
    pagination: {
      page: Number(body.pagination?.page ?? 1),
      limit,
      total,
      totalPages: Number(body.pagination?.totalPages ?? Math.max(1, Math.ceil(total / limit))),
    },
  };
}

export async function updateUserDisabled(
  userId: string,
  disabled: boolean,
  reason?: string
): Promise<User> {
  const res = await apiPatch(`/users/${encodeURIComponent(userId)}/status`, { disabled, reason });
  await assertOk(res, 'Failed to update user');
  const body = (await res.json()) as {
    data?: Record<string, unknown>;
    user?: Record<string, unknown>;
  };
  return normalizeUser(body.data ?? body.user ?? {});
}

export async function suspendUser(userId: string, reason: string): Promise<User> {
  const res = await apiPost(`/users/${encodeURIComponent(userId)}/suspend`, { reason });
  await assertOk(res, 'Failed to suspend user');
  const body = (await res.json()) as {
    data?: Record<string, unknown>;
    user?: Record<string, unknown>;
  };
  return normalizeUser(body.data ?? body.user ?? {});
}

export async function unsuspendUser(userId: string): Promise<User> {
  const res = await apiPost(`/users/${encodeURIComponent(userId)}/unsuspend`, {});
  await assertOk(res, 'Failed to unsuspend user');
  const body = (await res.json()) as {
    data?: Record<string, unknown>;
    user?: Record<string, unknown>;
  };
  return normalizeUser(body.data ?? body.user ?? {});
}

export async function updateUserRole(
  userId: string,
  role: UserRole,
  reason?: string
): Promise<User> {
  const res = await apiPatch(`/users/${encodeURIComponent(userId)}/role`, { role, reason });
  await assertOk(res, 'Failed to update user role');
  const body = (await res.json()) as {
    data?: Record<string, unknown>;
    user?: Record<string, unknown>;
  };
  return normalizeUser(body.data ?? body.user ?? {});
}
