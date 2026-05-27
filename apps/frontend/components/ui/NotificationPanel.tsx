'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem as Notification,
} from '@/lib/api/notifications';
import type { UserRole } from '@/types';
import { NotificationItem } from './NotificationItem';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';

const POLL_INTERVAL_MS = 60_000;

export function NotificationPanel({
  open,
  onClose,
  role = 'candidate',
  unreadCount,
  onUnreadCountChange,
}: {
  open: boolean;
  onClose: () => void;
  role?: UserRole;
  unreadCount: number;
  onUnreadCountChange: (count: number) => void;
}) {
  const { t } = useTranslations();
  const panelRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const notificationsPath =
    role === 'recruiter' ? '/recruiter/notifications' : '/candidate/notifications';

  const refreshUnreadCount = useCallback(async () => {
    try {
      const count = await fetchUnreadCount();
      onUnreadCountChange(count);
    } catch {
      // Keep previous badge count on poll failure
    }
  }, [onUnreadCountChange]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchNotifications({ limit: 12 });
      setItems(result.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('errors.loadNotifications'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    refreshUnreadCount();
    const interval = window.setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!open) return;
    void loadNotifications();
  }, [open, loadNotifications]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  async function handleMarkRead(notification: Notification) {
    if (notification.readAt) return;
    try {
      await markNotificationRead(notification.id);
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item
        )
      );
      onUnreadCountChange(Math.max(0, unreadCount - 1));
      void refreshUnreadCount();
    } catch {
      // Non-blocking for navigation
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setItems((current) =>
        current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))
      );
      onUnreadCountChange(0);
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : t('errors.markAllRead'));
    } finally {
      setMarkingAll(false);
    }
  }

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-[var(--blue-700)]" />
          <p className="text-sm font-semibold text-[var(--text-1)]">{t('common.notifications')}</p>
          {unreadCount > 0 ? (
            <span className="rounded-full bg-[var(--blue-700)] px-2 py-0.5 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </div>
        <button
          className="flex items-center gap-1 text-xs font-medium text-[var(--blue-700)] disabled:opacity-50"
          disabled={markingAll || unreadCount === 0}
          onClick={() => void handleMarkAllRead()}
          type="button"
        >
          {markingAll ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <CheckCheck className="size-3" />
          )}
          {t('common.markAllRead')}
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--text-3)]">
            <Loader2 className="size-4 animate-spin" />
            {t('common.loading')}...
          </div>
        ) : null}
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-[var(--danger)]">{error}</p>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-3)]">
            {t('notifications.empty')}
          </p>
        ) : null}
        {!loading
          ? items.map((notification) => (
              <NotificationItem
                key={notification.id}
                compact
                notification={notification}
                onRead={(item) => void handleMarkRead(item)}
                role={role}
              />
            ))
          : null}
      </div>

      <div className="border-t border-[var(--border)] px-4 py-3">
        <Link
          className={cn(
            'block text-center text-xs font-semibold text-[var(--blue-700)] hover:underline'
          )}
          href={notificationsPath}
          onClick={onClose}
        >
          {t('notifications.viewAll')}
        </Link>
      </div>
    </div>
  );
}
