import { apiFetch, apiPost } from './client';

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

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  let detail = '';
  try {
    const payload = (await res.json()) as { message?: string; detail?: string };
    detail = payload?.message || payload?.detail || '';
  } catch {
    // Ignore parse failures and use fallback message.
  }

  return detail || fallback;
}

export async function signup(payload: {
  email: string;
  password: string;
  full_name: string;
  role?: UserRole;
}): Promise<AuthResponse> {
  const res = await apiPost('/auth/signup', payload);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `Signup failed (status ${res.status})`));
  }
  return (await res.json()) as AuthResponse;
}

export async function login(payload: { email: string; password: string }): Promise<AuthResponse> {
  const res = await apiPost('/auth/login', payload);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `Login failed (status ${res.status})`));
  }
  return (await res.json()) as AuthResponse;
}

export async function fetchMe(accessToken: string): Promise<{ user: AuthUser }> {
  const res = await apiFetch('/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `Fetch profile failed (status ${res.status})`));
  }

  return (await res.json()) as { user: AuthUser };
}

export async function forgotPassword(email: string): Promise<{ message: string; reset_token?: string }> {
  const res = await apiPost('/auth/forgot-password', { email });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `Forgot password failed (status ${res.status})`));
  }
  return (await res.json()) as { message: string; reset_token?: string };
}

export async function resetPassword(payload: { token: string; new_password: string }): Promise<{ message: string }> {
  const res = await apiPost('/auth/reset-password', payload);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `Reset password failed (status ${res.status})`));
  }
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

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `Change password failed (status ${res.status})`));
  }

  return (await res.json()) as { message: string };
}
