/**
 * Centralized API Client
 *
 * Single source of truth for API configuration and base fetch utilities.
 */

const DEFAULT_PUBLIC_API_BASE_URL = '/';
const DEFAULT_INTERNAL_API_BASE_URL = 'http://127.0.0.1:3001';
const AUTH_STORAGE_KEY = 'cvm_auth_session_v1';

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
    const parsed = JSON.parse(raw) as { accessToken?: string };
    const accessToken = String(parsed?.accessToken || '').trim();
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

/**
 * Standard fetch wrapper with common error handling.
 * Returns the Response object for flexibility.
 *
 * @param endpoint - API endpoint path or absolute URL
 * @param options - Standard RequestInit options
 * @param timeoutMs - Optional request timeout in milliseconds (default: 240_000)
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
    // Ensure browser client calls to "/api/..." use the configured public API host
    // when NEXT_PUBLIC_API_BASE_URL is set (e.g. http://localhost:3001).
    const publicBase = API_BASE_URL || '/';
    if (publicBase === '/' || publicBase === '') {
      // Same-origin: keep relative API path
      url = normalizedEndpoint;
    } else {
      const host = publicBase.replace(/\/+$/, '');
      url = `${host}${normalizedEndpoint}`;
    }
  }

  // Matches the backend's 240s hard limit (resumes.py wait_for timeout)
  const timeout = timeoutMs ?? 240_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const headers = buildRequestHeaders(options?.headers);
    return await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
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
  const publicBase = API_BASE_URL || '/';
  if (publicBase === '/' || publicBase === '') {
    return '/resumes/upload';
  }
  return `${publicBase.replace(/\/+$/, '')}/api/resumes/upload`;
}
