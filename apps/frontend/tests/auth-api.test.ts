import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiFetch: vi.fn(),
  apiPost: vi.fn(),
}));

import {
  changePassword,
  fetchMe,
  forgotPassword,
  login,
  resetPassword,
  signup,
} from '@/lib/api/auth';
import { apiFetch, apiPost } from '@/lib/api/client';

const mockedApiFetch = vi.mocked(apiFetch);
const mockedApiPost = vi.mocked(apiPost);

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('auth API client', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedApiPost.mockReset();
  });

  it('signup posts payload and returns auth response', async () => {
    mockedApiPost.mockResolvedValueOnce(
      jsonResponse({
        user: { id: 'u-1', email: 'candidate@example.com', role: 'candidate', full_name: 'Candidate', avatar: null },
        access_token: 'token-1',
        token_type: 'Bearer',
        expires_in: '7d',
      })
    );

    const result = await signup({
      email: 'candidate@example.com',
      password: 'StrongPass123',
      full_name: 'Candidate',
    });

    expect(result.access_token).toBe('token-1');
    expect(mockedApiPost).toHaveBeenCalledWith('/auth/signup', {
      email: 'candidate@example.com',
      password: 'StrongPass123',
      full_name: 'Candidate',
    });
  });

  it('login throws backend detail on failure', async () => {
    mockedApiPost.mockResolvedValueOnce(jsonResponse({ message: 'Invalid email or password' }, 401));

    await expect(login({ email: 'candidate@example.com', password: 'bad' })).rejects.toThrow(
      'Invalid email or password'
    );
  });

  it('login keeps backend error_code for downstream handling', async () => {
    mockedApiPost.mockResolvedValueOnce(
      jsonResponse({ message: 'Account locked', error_code: 'account_locked' }, 423)
    );

    await expect(login({ email: 'candidate@example.com', password: 'bad' })).rejects.toMatchObject({
      errorCode: 'account_locked',
      statusCode: 423,
    });
  });

  it('fetchMe sends bearer token and returns user', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse({ user: { id: 'u-1', email: 'candidate@example.com', role: 'candidate', full_name: 'Candidate', avatar: null } })
    );

    const result = await fetchMe('token-abc');

    expect(result.user.id).toBe('u-1');
    expect(mockedApiFetch).toHaveBeenCalledWith('/auth/me', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer token-abc',
      },
    });
  });

  it('forgot/reset/change password call expected endpoints', async () => {
    mockedApiPost.mockResolvedValueOnce(
      jsonResponse({
        message: 'If the account exists, a reset instruction has been generated',
        reset_token: 'reset-token-1',
      })
    );
    mockedApiPost.mockResolvedValueOnce(jsonResponse({ message: 'Password has been reset successfully' }));
    mockedApiFetch.mockResolvedValueOnce(jsonResponse({ message: 'Password updated successfully' }));

    const forgot = await forgotPassword('candidate@example.com');
    const reset = await resetPassword({ token: 'reset-token-1', new_password: 'NewStrongPass123' });
    const changed = await changePassword('token-abc', {
      current_password: 'StrongPass123',
      new_password: 'NewStrongPass123',
    });

    expect(forgot.reset_token).toBe('reset-token-1');
    expect(reset.message).toBe('Password has been reset successfully');
    expect(changed.message).toBe('Password updated successfully');

    expect(mockedApiPost).toHaveBeenNthCalledWith(1, '/auth/forgot-password', {
      email: 'candidate@example.com',
    });
    expect(mockedApiPost).toHaveBeenNthCalledWith(2, '/auth/reset-password', {
      token: 'reset-token-1',
      new_password: 'NewStrongPass123',
    });
    expect(mockedApiFetch).toHaveBeenCalledWith('/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-abc',
      },
      body: JSON.stringify({
        current_password: 'StrongPass123',
        new_password: 'NewStrongPass123',
      }),
    });
  });
});
