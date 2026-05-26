import { apiFetch, apiPatch } from './client';
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
  return res.json();
}

export async function updateUserDisabled(userId: string, disabled: boolean): Promise<User> {
  const res = await apiPatch(`/users/${encodeURIComponent(userId)}/status`, { disabled });
  await assertOk(res, 'Failed to update user');
  const body = (await res.json()) as { data: User };
  return body.data;
}
