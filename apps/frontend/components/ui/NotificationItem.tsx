'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import type { NotificationItem as Notification } from '@/lib/api/notifications';
import type { UserRole } from '@/types';

function payloadValue(payload: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function getNotificationHref(
  notification: Notification,
  role: UserRole = 'candidate'
): string | null {
  const { type, payload } = notification;
  const applicationId = payloadValue(payload, 'application_id', 'applicationId');
  const jobId = payloadValue(payload, 'job_id', 'jobId');

  if (role === 'candidate') {
    if (type === 'application_status_changed' || type === 'ai_scoring_completed') {
      return applicationId ? `/candidate/applications/${applicationId}` : null;
    }
    if (type === 'job_closed') {
      if (jobId) return `/candidate/jobs/${jobId}`;
      if (applicationId) return `/candidate/applications/${applicationId}`;
    }
    return null;
  }

  if (role === 'recruiter') {
    if (jobId) {
      if (type === 'job_closed') return `/recruiter/jobs/${jobId}`;
      return `/recruiter/jobs/${jobId}/candidates`;
    }
    return null;
  }

  return null;
}

function formatRelativeTime(
  value: string,
  t: (key: string, params?: Record<string, string | number>) => string,
  locale: string
) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return t('notifications.relative.justNow');
  if (minutes < 60) return t('notifications.relative.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('notifications.relative.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('notifications.relative.daysAgo', { count: days });
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date);
}

export function NotificationItem({
  notification,
  role = 'candidate',
  compact = false,
  onRead,
}: {
  notification: Notification;
  role?: UserRole;
  compact?: boolean;
  onRead?: (notification: Notification) => void;
}) {
  const { t, locale } = useTranslations();
  const href = getNotificationHref(notification, role);
  const isUnread = !notification.readAt;

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            'text-sm leading-snug',
            isUnread ? 'font-semibold text-[var(--text-1)]' : 'text-[var(--text-1)]'
          )}
        >
          {notification.title}
        </p>
        {isUnread ? (
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--blue-700)]" />
        ) : null}
      </div>
      <p className={cn('mt-1 text-[var(--text-2)]', compact ? 'text-xs line-clamp-2' : 'text-sm')}>
        {notification.body}
      </p>
      <p className="mt-2 text-xs text-[var(--text-3)]">
        {formatRelativeTime(notification.createdAt, t, locale)}
      </p>
    </>
  );

  const className = cn(
    'block rounded-xl border px-3 py-3 transition',
    isUnread
      ? 'border-[var(--blue-100)] bg-[var(--blue-50)]/60'
      : 'border-transparent bg-white hover:border-[var(--border)] hover:bg-gray-50'
  );

  if (href) {
    return (
      <Link className={className} href={href} onClick={() => onRead?.(notification)}>
        {content}
      </Link>
    );
  }

  return (
    <button
      className={cn(className, 'w-full text-left')}
      onClick={() => onRead?.(notification)}
      type="button"
    >
      {content}
    </button>
  );
}
