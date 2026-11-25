import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { renderHook } from '@testing-library/react';
import { proxy } from '@/proxy';
import { useNotificationStream } from '@/lib/hooks/use-notification-stream';
import enMessages from '@/messages/en.json';
import viMessages from '@/messages/vi.json';

function makeJwtWithRole(role: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ id: 'u1', role })).toString('base64url');
  return `${header}.${payload}.sig`;
}

describe('Phase 5 RBAC proxy, silent refresh, SSE hook, and i18n parity', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('routes 4 roles to dedicated dashboards and blocks cross-role access', () => {
    const ownerReq = new NextRequest('http://localhost:3000/admin/health', {
      headers: { cookie: `cvm_token=${makeJwtWithRole('platform_owner')}` },
    });
    const ownerRes = proxy(ownerReq);
    expect(ownerRes.status).toBe(307);
    expect(ownerRes.headers.get('location')).toContain('/owner/dashboard');

    const staffViaAliasReq = new NextRequest('http://localhost:3000/login', {
      headers: { cookie: `cvm_token=${makeJwtWithRole('admin')}` },
    });
    const staffRes = proxy(staffViaAliasReq);
    expect(staffRes.status).toBe(307);
    expect(staffRes.headers.get('location')).toContain('/admin/health');

    const candBlockedOwner = new NextRequest('http://localhost:3000/owner/funnel', {
      headers: { cookie: `cvm_token=${makeJwtWithRole('candidate')}` },
    });
    const candRes = proxy(candBlockedOwner);
    expect(candRes.status).toBe(307);
    expect(candRes.headers.get('location')).toContain('/candidate/dashboard');
  });

  it('silently refreshes access token on 401 and retries original request once', async () => {
    window.localStorage.setItem(
      'cvm_auth_session_v1',
      JSON.stringify({ accessToken: 'expired-token' })
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'fresh-token' }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);
    const { apiFetch } = await import('@/lib/api/client');
    const res = await apiFetch('/applications/history');

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh');
    expect((fetchMock.mock.calls[2][1]?.headers as Headers).get('Authorization')).toBe(
      'Bearer fresh-token'
    );
  });

  it('subscribes to SSE notification events via EventSource', () => {
    let listener: ((event: MessageEvent<string>) => void) | null = null;
    const closeMock = vi.fn();

    class MockEventSource {
      constructor(public url: string) {}
      addEventListener(type: string, cb: (event: MessageEvent<string>) => void) {
        if (type === 'notification') listener = cb;
      }
      removeEventListener() {}
      close() {
        closeMock();
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);
    const onNotification = vi.fn();

    const { unmount } = renderHook(() =>
      useNotificationStream({ enabled: true, accessToken: 'tok-sse', onNotification })
    );

    expect(listener).not.toBeNull();
    listener!(
      new MessageEvent('notification', {
        data: JSON.stringify({ id: 'n1', type: 'application_status_changed', title: 'Interview' }),
      })
    );
    expect(onNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', title: 'Interview' })
    );

    unmount();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('maintains en/vi message parity for new Phase 5 sections', () => {
    expect(Object.keys(enMessages.owner.dashboard)).toEqual(
      Object.keys(viMessages.owner.dashboard)
    );
    expect(Object.keys(enMessages.admin.health)).toEqual(Object.keys(viMessages.admin.health));
    expect(Object.keys(enMessages.practiceInterview)).toEqual(
      Object.keys(viMessages.practiceInterview)
    );
  });
});
