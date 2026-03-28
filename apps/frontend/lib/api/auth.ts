import { apiFetch, apiPost } from './client';
import { buildApiClientError } from './error';

export type UserRole = 'candidate' | 'recruiter' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  avatar: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: AuthUser;
  access_token: string;
  token_type: 'Bearer';
  expires_in: string;
}

async function throwIfNotOk(res: Response, fallbackMessagePrefix: string): Promise<void> {
  if (res.ok) return;
  const text = await res.text().catch(() => '');
  throw buildApiClientError(res.status, text, fallbackMessagePrefix);
}

export async function signup(payload: {
  email: string;
  password: string;
  full_name: string;
  role?: UserRole;
}): Promise<AuthResponse> {
  const res = await apiPost('/auth/signup', payload);
  await throwIfNotOk(res, 'Signup failed');
  return (await res.json()) as AuthResponse;
}

export async function login(payload: { email: string; password: string }): Promise<AuthResponse> {
  const res = await apiPost('/auth/login', payload);
  await throwIfNotOk(res, 'Login failed');
  return (await res.json()) as AuthResponse;
}

export async function fetchMe(accessToken: string): Promise<{ user: AuthUser }> {
  const res = await apiFetch('/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  await throwIfNotOk(res, 'Fetch profile failed');

  return (await res.json()) as { user: AuthUser };
}

export async function forgotPassword(email: string): Promise<{ message: string; reset_token?: string }> {
  const res = await apiPost('/auth/forgot-password', { email });
  await throwIfNotOk(res, 'Forgot password failed');
  return (await res.json()) as { message: string; reset_token?: string };
}

export async function resetPassword(payload: { token: string; new_password: string }): Promise<{ message: string }> {
  const res = await apiPost('/auth/reset-password', payload);
  await throwIfNotOk(res, 'Reset password failed');
  return (await res.json()) as { message: string };
}

export async function changePassword(
  accessToken: string,
  payload: { current_password: string; new_password: string }
): Promise<{ message: string }> {
  const res = await apiFetch('/auth/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  await throwIfNotOk(res, 'Change password failed');

  return (await res.json()) as { message: string };
}
