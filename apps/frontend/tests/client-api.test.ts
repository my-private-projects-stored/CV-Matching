import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = {
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  INTERNAL_API_BASE_URL: process.env.INTERNAL_API_BASE_URL,
};

async function loadClientModule() {
  vi.resetModules();
  return import('@/lib/api/client');
}

describe('api client module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.INTERNAL_API_BASE_URL;
  });

  afterEach(() => {
    if (ORIGINAL_ENV.NEXT_PUBLIC_API_BASE_URL === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = ORIGINAL_ENV.NEXT_PUBLIC_API_BASE_URL;
    }

    if (ORIGINAL_ENV.NEXT_PUBLIC_API_URL === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = ORIGINAL_ENV.NEXT_PUBLIC_API_URL;
    }

    if (ORIGINAL_ENV.INTERNAL_API_BASE_URL === undefined) {
      delete process.env.INTERNAL_API_BASE_URL;
    } else {
      process.env.INTERNAL_API_BASE_URL = ORIGINAL_ENV.INTERNAL_API_BASE_URL;
    }

    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses /api by default and builds upload URL from API_BASE', async () => {
    const { API_BASE_URL, API_BASE, getUploadUrl } = await loadClientModule();

    expect(API_BASE_URL).toBe('/');
    expect(API_BASE).toBe('/api');
    expect(getUploadUrl()).toBe('/api/resumes/upload');
  });

  it('normalizes NEXT_PUBLIC_API_BASE_URL and builds API_BASE', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3001/';

    const { API_BASE_URL, API_BASE } = await loadClientModule();

    expect(API_BASE_URL).toBe('http://127.0.0.1:3001');
    expect(API_BASE).toBe('http://127.0.0.1:3001/api');
  });

  it('uses INTERNAL_API_BASE_URL for API_BASE in server runtime', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = '/';
    process.env.INTERNAL_API_BASE_URL = 'http://gateway-backend:3001/';
    vi.stubGlobal('window', undefined);

    const { API_BASE } = await loadClientModule();

    expect(API_BASE).toBe('http://gateway-backend:3001/api');
  });

  it('apiFetch normalizes relative endpoint and keeps absolute URL unchanged', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { apiFetch } = await loadClientModule();

    await apiFetch('health');
    await apiFetch('https://example.com/health');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://example.com/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('apiFetch does not double-prefix endpoints that already start with /api', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { apiFetch } = await loadClientModule();

    await apiFetch('/api/status');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/status',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('apiPost/apiPatch/apiPut/apiDelete set expected methods and payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { apiPost, apiPatch, apiPut, apiDelete } = await loadClientModule();

    await apiPost('/x', { a: 1 });
    await apiPatch('/y', { b: 2 });
    await apiPut('/z', { c: 3 });
    await apiDelete('/w');

    expect(fetchMock).toHaveBeenCalledTimes(4);

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall[0]).toBe('/api/x');
    expect((firstCall[1] as RequestInit).method).toBe('POST');
    expect((firstCall[1] as RequestInit).body).toBe(JSON.stringify({ a: 1 }));
    expect(new Headers((firstCall[1] as RequestInit).headers).get('Content-Type')).toBe(
      'application/json'
    );

    const secondCall = fetchMock.mock.calls[1];
    expect(secondCall[0]).toBe('/api/y');
    expect((secondCall[1] as RequestInit).method).toBe('PATCH');
    expect((secondCall[1] as RequestInit).body).toBe(JSON.stringify({ b: 2 }));
    expect(new Headers((secondCall[1] as RequestInit).headers).get('Content-Type')).toBe(
      'application/json'
    );

    const thirdCall = fetchMock.mock.calls[2];
    expect(thirdCall[0]).toBe('/api/z');
    expect((thirdCall[1] as RequestInit).method).toBe('PUT');
    expect((thirdCall[1] as RequestInit).body).toBe(JSON.stringify({ c: 3 }));
    expect(new Headers((thirdCall[1] as RequestInit).headers).get('Content-Type')).toBe(
      'application/json'
    );

    const fourthCall = fetchMock.mock.calls[3];
    expect(fourthCall[0]).toBe('/api/w');
    expect((fourthCall[1] as RequestInit).method).toBe('DELETE');
  });

  it('apiFetch auto-attaches bearer token from localStorage when no Authorization header is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn(() => JSON.stringify({ accessToken: 'token-from-storage' })),
      },
    });

    const { apiFetch } = await loadClientModule();

    await apiFetch('/secured', { method: 'GET' });

    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe('/api/secured');
    const headers = new Headers((call[1] as RequestInit).headers);
    expect(headers.get('Authorization')).toBe('Bearer token-from-storage');
  });

  it('apiFetch auto-attaches bearer token from legacy storage field access_token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn(() => JSON.stringify({ access_token: 'legacy-token-from-storage' })),
      },
    });

    const { apiFetch } = await loadClientModule();

    await apiFetch('/secured', { method: 'GET' });

    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe('/api/secured');
    const headers = new Headers((call[1] as RequestInit).headers);
    expect(headers.get('Authorization')).toBe('Bearer legacy-token-from-storage');
  });

  it('apiFetch aborts when request exceeds timeout', async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn().mockImplementation((_: string, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { apiFetch } = await loadClientModule();

    const promise = apiFetch('/slow', undefined, 10);
    const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(11);
    await assertion;
  });
});
