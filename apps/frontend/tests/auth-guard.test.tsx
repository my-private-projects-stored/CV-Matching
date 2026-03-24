import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedReplace = vi.fn();
let mockedPathname = '/dashboard';
let mockedAuthState: {
  user: { id: string; role: 'candidate' | 'recruiter' | 'admin' } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockedReplace }),
  usePathname: () => mockedPathname,
}));

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => mockedAuthState,
}));

import { AuthGuard } from '@/components/common/auth-guard';

describe('AuthGuard', () => {
  beforeEach(() => {
    mockedReplace.mockReset();
    mockedPathname = '/dashboard';
    mockedAuthState = {
      user: { id: 'u-1', role: 'candidate' },
      isAuthenticated: true,
      isLoading: false,
    };
  });

  it('redirects unauthenticated users to login with next path', async () => {
    mockedPathname = '/settings';
    mockedAuthState = {
      user: null,
      isAuthenticated: false,
      isLoading: false,
    };

    render(
      <AuthGuard>
        <div>protected</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockedReplace).toHaveBeenCalledWith('/login?next=%2Fsettings');
    });
  });

  it('redirects candidate away from recruiter-only settings route', async () => {
    mockedPathname = '/settings';
    mockedAuthState = {
      user: { id: 'u-1', role: 'candidate' },
      isAuthenticated: true,
      isLoading: false,
    };

    render(
      <AuthGuard>
        <div>settings page</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockedReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('redirects recruiter away from candidate-only profile route', async () => {
    mockedPathname = '/profile';
    mockedAuthState = {
      user: { id: 'u-2', role: 'recruiter' },
      isAuthenticated: true,
      isLoading: false,
    };

    render(
      <AuthGuard>
        <div>profile page</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockedReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it.each(['/builder', '/tailor', '/resumes/abc123'])(
    'redirects recruiter away from candidate-only route %s',
    async (path) => {
      mockedPathname = path;
      mockedAuthState = {
        user: { id: 'u-2', role: 'recruiter' },
        isAuthenticated: true,
        isLoading: false,
      };

      render(
        <AuthGuard>
          <div>candidate only page</div>
        </AuthGuard>
      );

      await waitFor(() => {
        expect(mockedReplace).toHaveBeenCalledWith('/dashboard');
      });
    }
  );

  it('allows recruiter on settings route', async () => {
    mockedPathname = '/settings';
    mockedAuthState = {
      user: { id: 'u-3', role: 'recruiter' },
      isAuthenticated: true,
      isLoading: false,
    };

    render(
      <AuthGuard>
        <div>settings page</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockedReplace).not.toHaveBeenCalled();
    });
  });
});
