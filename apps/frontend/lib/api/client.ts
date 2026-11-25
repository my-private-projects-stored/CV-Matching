/**
 * Centralized API Client
 *
 * Single source of truth for API configuration and base fetch utilities.
 */

const DEFAULT_PUBLIC_API_BASE_URL = '/';
const DEFAULT_INTERNAL_API_BASE_URL = 'http://127.0.0.1:3001';
export const AUTH_STORAGE_KEY = 'cvm_auth_session_v1';
export const AUTH_TOKEN_COOKIE = 'cvm_token';

function normalizeApiUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }
  return trimmed.replace(/\/+$/, '');
}

function toApiBase(baseUrl: string): string {
  if (baseUrl === '/') {
    return '/api';
  }
  return `${baseUrl}/api`;
}

function resolveRuntimeApiBase(apiBase: string): string {
  const internalApiBaseUrl = normalizeApiUrl(
    process.env.INTERNAL_API_BASE_URL ?? DEFAULT_INTERNAL_API_BASE_URL
  );

  if (typeof window !== 'undefined' || !apiBase.startsWith('/')) {
    return apiBase;
  }

  if (internalApiBaseUrl === '/') {
    return apiBase;
  }

  return `${internalApiBaseUrl}${apiBase}`;
}

export const API_BASE_URL = normalizeApiUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    DEFAULT_PUBLIC_API_BASE_URL
);
// Backward-compatible alias used by existing settings UI.
export const API_URL = API_BASE_URL;
export const API_BASE = resolveRuntimeApiBase(toApiBase(API_BASE_URL));

function readAccessTokenFromStorage(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      accessToken?: string;
      access_token?: string;
      token?: string;
      session?: {
        accessToken?: string;
        access_token?: string;
        token?: string;
      };
    };
    const accessToken = String(
      parsed?.accessToken ||
        parsed?.access_token ||
        parsed?.token ||
        parsed?.session?.accessToken ||
        parsed?.session?.access_token ||
        parsed?.session?.token ||
        ''
    ).trim();
    return accessToken || null;
  } catch {
    return null;
  }
}

function buildRequestHeaders(headers?: HeadersInit): Headers {
  const mergedHeaders = new Headers(headers || undefined);
  if (mergedHeaders.has('Authorization')) {
    return mergedHeaders;
  }

  const accessToken = readAccessTokenFromStorage();
  if (accessToken) {
    mergedHeaders.set('Authorization', `Bearer ${accessToken}`);
  }

  return mergedHeaders;
}

let silentRefreshPromise: Promise<string | null> | null = null;

function isAuthBypassEndpoint(endpoint: string): boolean {
  return (
    endpoint.includes('/auth/login') ||
    endpoint.includes('/auth/signup') ||
    endpoint.includes('/auth/register') ||
    endpoint.includes('/auth/refresh')
  );
}

function updateStoredAccessToken(nextToken: string | null) {
  if (typeof window === 'undefined') return;
  if (!nextToken) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthTokenCookie(null);
    return;
  }
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ ...parsed, accessToken: nextToken })
    );
    setAuthTokenCookie(nextToken);
  } catch {
    // Ignore storage write errors
  }
}

async function attemptSilentRefresh(refreshUrl: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!readAccessTokenFromStorage()) return null;

  if (!silentRefreshPromise) {
    silentRefreshPromise = (async () => {
      try {
        const res = await fetch(refreshUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          updateStoredAccessToken(null);
          return null;
        }
        const data = (await res.json()) as { access_token?: string; token?: string };
        const nextToken = String(data?.access_token || data?.token || '').trim();
        if (!nextToken) {
          updateStoredAccessToken(null);
          return null;
        }
        updateStoredAccessToken(nextToken);
        return nextToken;
      } catch {
        return null;
      } finally {
        silentRefreshPromise = null;
      }
    })();
  }

  return silentRefreshPromise;
}

/**
 * Standard fetch wrapper with common error handling and deduplicated 401 Silent Refresh.
 * Returns the Response object for flexibility.
 */
export async function apiFetch(
  endpoint: string,
  options?: RequestInit,
  timeoutMs?: number
): Promise<Response> {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const isAbsoluteUrl = endpoint.startsWith('http://') || endpoint.startsWith('https://');
  const isApiPath = normalizedEndpoint.startsWith('/api/');
  let url = `${API_BASE}${normalizedEndpoint}`;

  if (isAbsoluteUrl) {
    url = endpoint;
  } else if (isApiPath) {
    const publicBase = API_BASE_URL || '/';
    if (publicBase === '/' || publicBase === '') {
      url = normalizedEndpoint;
    } else {
      const host = publicBase.replace(/\/+$/, '');
      url = `${host}${normalizedEndpoint}`;
    }
  }

  const timeout = timeoutMs ?? 240_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const headers = buildRequestHeaders(options?.headers);
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (response.status === 401 && !isAuthBypassEndpoint(normalizedEndpoint)) {
      const refreshUrl = isApiPath ? '/api/auth/refresh' : `${API_BASE}/auth/refresh`;
      const refreshedToken = await attemptSilentRefresh(refreshUrl);
      if (refreshedToken) {
        const retryHeaders = new Headers(options?.headers || undefined);
        retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);
        return await fetch(url, {
          ...options,
          headers: retryHeaders,
          signal: controller.signal,
        });
      }
    }

    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST request with JSON body.
 */
export async function apiPost<T>(endpoint: string, body: T, timeoutMs?: number): Promise<Response> {
  return apiFetch(
    endpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    timeoutMs
  );
}

/**
 * PATCH request with JSON body.
 */
export async function apiPatch<T>(endpoint: string, body: T): Promise<Response> {
  return apiFetch(endpoint, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * PUT request with JSON body.
 */
export async function apiPut<T>(endpoint: string, body: T): Promise<Response> {
  return apiFetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * DELETE request.
 */
export async function apiDelete(endpoint: string): Promise<Response> {
  return apiFetch(endpoint, { method: 'DELETE' });
}

/**
 * Builds the full upload URL for file uploads.
 */
export function getUploadUrl(): string {
  return `${API_BASE}/resumes/upload`;
}

/** Health check — no auth required */
export async function fetchHealth(): Promise<{ status: string }> {
  const res = await apiFetch('/health');
  if (!res.ok) {
    throw new Error('Health check failed');
  }
  return res.json();
}

export function setAuthTokenCookie(token: string | null) {
  if (typeof document === 'undefined') return;
  if (!token) {
    document.cookie = `${AUTH_TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
    return;
  }
  document.cookie = `${AUTH_TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

export function readAuthTokenCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${AUTH_TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
