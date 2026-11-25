'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ErrorBanner, PageHeader, SkeletonRow } from '@/components/ui';
import { fetchAuditLogs, type AuditLogEntry } from '@/lib/api/ops-analytics';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

export default function AdminAuditLogsPage() {
  const header = usePageHeader('adminAuditLogs');
  const { t } = useTranslations();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAuditLogs({ action: actionFilter || undefined, limit: 100 });
      setLogs(res.logs ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.loadAuditLogs'));
    } finally {
      setLoading(false);
    }
  }, [actionFilter, t]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title={header.title} subtitle={header.subtitle} />
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="">{t('admin.auditLogs.allActions')}</option>
            <option value="UPDATE_CONFIG">UPDATE_CONFIG</option>
            <option value="RETRY_DLQ">RETRY_DLQ</option>
            <option value="REINDEX_VECTORS">REINDEX_VECTORS</option>
          </select>
          <button
            type="button"
            onClick={() => void loadLogs()}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold"
          >
            <RefreshCw className="size-3.5" />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {loading ? <SkeletonRow /> : null}
      {error ? <ErrorBanner message={error} /> : null}

      {!loading && !error ? (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white p-5">
          {logs.length === 0 ? (
            <p className="text-sm text-[var(--text-3)]">{t('admin.auditLogs.empty')}</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-3)]">
                  <th className="pb-2">{t('admin.auditLogs.time')}</th>
                  <th className="pb-2">{t('admin.auditLogs.actor')}</th>
                  <th className="pb-2">{t('admin.auditLogs.action')}</th>
                  <th className="pb-2">{t('admin.auditLogs.target')}</th>
                  <th className="pb-2">{t('admin.auditLogs.reason')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {logs.map((entry) => (
                  <tr key={entry._id}>
                    <td className="py-2 font-mono text-[11px] text-[var(--text-2)]">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2">
                      {entry.actorId} ({entry.actorRole})
                    </td>
                    <td className="py-2">
                      <span className="rounded-full bg-[var(--blue-50)] px-2 py-0.5 font-semibold text-[var(--blue-700)]">
                        {entry.action}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-[11px]">
                      {entry.targetKey || entry.targetUserId || '-'}
                    </td>
                    <td className="py-2 text-[var(--text-2)]">{entry.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}
