'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { ErrorBanner, PageHeader, SkeletonRow } from '@/components/ui';
import {
  fetchQueuesSnapshot,
  retryDlq,
  type QueuesSnapshotResponse,
} from '@/lib/api/ops-analytics';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

export default function AdminQueuesPage() {
  const header = usePageHeader('adminQueues');
  const { t } = useTranslations();
  const [snapshot, setSnapshot] = useState<QueuesSnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyDlq, setBusyDlq] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadQueues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchQueuesSnapshot();
      setSnapshot(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.loadQueues'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadQueues();
  }, [loadQueues]);

  async function handleRetry(dlqName: 'application_scoring_queue_dlq' | 'notification_queue_dlq') {
    setBusyDlq(dlqName);
    setNotice(null);
    try {
      const res = await retryDlq(dlqName, 20);
      setNotice(`${t('admin.queues.retriedNotice')}: ${res.retriedCount} (${res.targetQueue})`);
      await loadQueues();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.retryDlq'));
    } finally {
      setBusyDlq(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title={header.title} subtitle={header.subtitle} />
        <button
          type="button"
          onClick={() => void loadQueues()}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold"
        >
          <RefreshCw className="size-3.5" />
          {t('common.refresh')}
        </button>
      </div>

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          {notice}
        </div>
      ) : null}
      {loading ? <SkeletonRow /> : null}
      {error ? <ErrorBanner message={error} /> : null}

      {snapshot ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(snapshot.depths).map(([queueName, depth]) => (
              <div
                key={queueName}
                className="rounded-xl border border-[var(--border)] bg-white p-4"
              >
                <p className="truncate font-mono text-[11px] text-[var(--text-3)]">{queueName}</p>
                <p className="mt-1 text-2xl font-bold text-[var(--text-1)]">{depth}</p>
              </div>
            ))}
          </div>

          {(['application_scoring_queue_dlq', 'notification_queue_dlq'] as const).map((dlqKey) => {
            const items = snapshot.dlqs[dlqKey] ?? [];
            return (
              <div key={dlqKey} className="rounded-2xl border border-[var(--border)] bg-white p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-sm font-semibold text-[var(--text-1)]">
                    {dlqKey} ({items.length})
                  </h2>
                  <button
                    type="button"
                    disabled={items.length === 0 || busyDlq === dlqKey}
                    onClick={() => void handleRetry(dlqKey)}
                    className="flex items-center gap-1.5 rounded-lg bg-[var(--blue-700)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    <RotateCcw className="size-3.5" />
                    {t('admin.queues.retryDlq')}
                  </button>
                </div>
                {items.length === 0 ? (
                  <p className="mt-3 text-xs text-[var(--text-3)]">{t('admin.queues.emptyDlq')}</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {items.slice(0, 10).map((item, idx) => (
                      <pre
                        key={`${dlqKey}-${idx}`}
                        className="overflow-x-auto rounded-lg bg-[var(--bg)] p-2 text-[11px] text-[var(--text-2)]"
                      >
                        {JSON.stringify(item, null, 2)}
                      </pre>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      ) : null}
    </div>
  );
}
