'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCheck, Loader2 } from 'lucide-react';
import { EmptyState, ErrorBanner, PageHeader, SkeletonRow } from '@/components/ui';
import { NotificationItem } from '@/components/ui/NotificationItem';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem as Notification,
} from '@/lib/api/notifications';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

export default function CandidateNotificationsPage() {
  const header = usePageHeader('candidateNotifications');
  const { t } = useTranslations();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [markingAll, setMarkingAll] = useState(false);

  const loadPage = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchNotifications({ page: nextPage, limit: 20 });
        setItems(result.data);
        setTotalPages(result.pagination.totalPages || 1);
        setPage(nextPage);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t('errors.loadNotifications'));
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    void loadPage(1);
  }, [loadPage]);

  async function handleMarkRead(notification: Notification) {
    if (notification.readAt) return;
    await markNotificationRead(notification.id);
    setItems((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item
      )
    );
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setItems((current) =>
        current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))
      );
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : t('errors.markAllRead'));
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={header.title}
        subtitle={header.subtitle}
        action={
          <button
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50"
            disabled={markingAll || items.every((item) => item.readAt)}
            onClick={() => void handleMarkAllRead()}
            type="button"
          >
            {markingAll ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCheck className="size-4" />
            )}
            {t('common.markAllRead')}
          </button>
        }
      />
      {loading ? (
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title={t('emptyStates.noNotifications.title')}
          description={t('emptyStates.noNotifications.description')}
          action={
            <Link className="text-sm font-semibold text-[var(--blue-700)]" href="/candidate/jobs">
              {t('emptyStates.noNotifications.action')}
            </Link>
          }
        />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-white p-3">
          {items.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRead={(item) => void handleMarkRead(item)}
              role="candidate"
            />
          ))}
        </div>
      ) : null}
      {!loading && totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <button
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => void loadPage(page - 1)}
            type="button"
          >
            {t('pagination.previous')}
          </button>
          <span className="text-sm text-[var(--text-2)]">
            {t('pagination.pageOf', { page, totalPages })}
          </span>
          <button
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => void loadPage(page + 1)}
            type="button"
          >
            {t('pagination.next')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
