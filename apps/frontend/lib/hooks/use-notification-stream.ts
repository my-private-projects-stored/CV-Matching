'use client';

import { useEffect, useRef } from 'react';
import { API_BASE } from '@/lib/api/client';
import type { NotificationItem } from '@/lib/api/notifications';

/**
 * Subscribe to real-time SSE notifications from /api/notifications/stream.
 */
export function useNotificationStream({
  enabled,
  accessToken,
  onNotification,
}: {
  enabled: boolean;
  accessToken: string | null;
  onNotification: (notification: NotificationItem) => void;
}) {
  const callbackRef = useRef(onNotification);

  useEffect(() => {
    callbackRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    if (!enabled || !accessToken || typeof EventSource === 'undefined') {
      return;
    }

    const streamUrl = `${API_BASE}/notifications/stream?token=${encodeURIComponent(accessToken)}`;
    const source = new EventSource(streamUrl);

    const handleNotification = (event: MessageEvent<string>) => {
      try {
        const raw = JSON.parse(event.data) as Record<string, unknown>;
        callbackRef.current({
          id: String(raw.id ?? raw._id ?? ''),
          type: String(raw.type ?? 'application_status_changed') as NotificationItem['type'],
          title: String(raw.title ?? ''),
          body: String(raw.body ?? ''),
          payload: (raw.payload as Record<string, unknown>) ?? {},
          readAt: raw.readAt ? String(raw.readAt) : null,
          emailSent: Boolean(raw.emailSent),
          createdAt: String(raw.createdAt ?? new Date().toISOString()),
        });
      } catch {
        // Ignore malformed SSE payload
      }
    };

    source.addEventListener('notification', handleNotification as EventListener);

    return () => {
      source.removeEventListener('notification', handleNotification as EventListener);
      source.close();
    };
  }, [enabled, accessToken]);
}
