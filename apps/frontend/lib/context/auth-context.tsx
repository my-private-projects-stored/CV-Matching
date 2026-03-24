'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { AuthUser } from '@/lib/api/auth';
import { fetchMe, login, signup, type UserRole } from '@/lib/api/auth';

type AuthSession = {
  accessToken: string;
  user: AuthUser;
};

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (payload: { email: string; password: string }) => Promise<AuthUser>;
  signUp: (payload: {
    email: string;
    password: string;
    full_name: string;
    role?: UserRole;
  }) => Promise<AuthUser>;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
};

const AUTH_STORAGE_KEY = 'cvm_auth_session_v1';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readSessionFromStorage(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed?.accessToken || !parsed?.user?.id) {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      user: parsed.user,
    };
  } catch {
    return null;
  }
}

function writeSessionToStorage(session: AuthSession | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const signOut = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    writeSessionToStorage(null);
  }, []);

  const applySession = useCallback((session: AuthSession | null) => {
    setUser(session?.user || null);
    setAccessToken(session?.accessToken || null);
    writeSessionToStorage(session);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!accessToken) return;

    try {
      const profile = await fetchMe(accessToken);
      applySession({
        accessToken,
        user: profile.user,
      });
    } catch {
      signOut();
    }
  }, [accessToken, applySession, signOut]);

  const signIn = useCallback(
    async (payload: { email: string; password: string }) => {
      const result = await login(payload);
      applySession({ accessToken: result.access_token, user: result.user });
      return result.user;
    },
    [applySession]
  );

  const signUp = useCallback(
    async (payload: {
      email: string;
      password: string;
      full_name: string;
      role?: UserRole;
    }) => {
      const result = await signup(payload);
      applySession({ accessToken: result.access_token, user: result.user });
      return result.user;
    },
    [applySession]
  );

  useEffect(() => {
    const session = readSessionFromStorage();
    if (session) {
      setUser(session.user);
      setAccessToken(session.accessToken);
    }
    setIsLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: Boolean(user && accessToken),
      isLoading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [user, accessToken, isLoading, signIn, signUp, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
