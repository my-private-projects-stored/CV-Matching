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

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/x',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: 1 }),
      })
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/y',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ b: 2 }),
      })
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/z',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ c: 3 }),
      })
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/w',
      expect.objectContaining({ method: 'DELETE' })
    );
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
