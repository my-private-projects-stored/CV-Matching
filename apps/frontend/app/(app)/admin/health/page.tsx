'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { ErrorBanner, PageHeader, SkeletonRow } from '@/components/ui';
import {
  fetchClusterHealth,
  type ClusterHealthResponse,
  type ClusterNodeStatus,
} from '@/lib/api/ops-analytics';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

function NodeGroup({ title, nodes }: { title: string; nodes: ClusterNodeStatus[] }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <h2 className="text-sm font-semibold text-[var(--text-1)]">{title}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {nodes.map((node) => (
          <div
            key={node.name}
            className={`rounded-xl border p-3 ${
              node.status === 'up'
                ? 'border-emerald-200 bg-emerald-50/50'
                : 'border-red-300 bg-red-50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold text-[var(--text-1)]">
                {node.name}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  node.status === 'up' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                }`}
              >
                {node.status}
              </span>
            </div>
            <p className="mt-1 font-mono text-[11px] text-[var(--text-2)]">{node.latency_ms} ms</p>
            {node.error ? (
              <p className="mt-1 truncate text-[10px] text-red-700">{node.error}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminHealthPage() {
  const header = usePageHeader('adminHealth');
  const { t } = useTranslations();
  const [health, setHealth] = useState<ClusterHealthResponse | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetchClusterHealth();
      setHealth(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.loadClusterHealth'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => void loadHealth(), 10_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadHealth]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title={header.title} subtitle={header.subtitle} />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--text-2)]">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            {t('admin.health.autoRefresh')} (10s)
          </label>
          <button
            type="button"
            onClick={() => void loadHealth()}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-1)]"
          >
            <RefreshCw className="size-3.5" />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {loading ? <SkeletonRow /> : null}
      {error ? <ErrorBanner message={error} /> : null}

      {health ? (
        <>
          {health.status === 'degraded' ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">
              <Activity className="size-4" />
              {t('admin.health.degradedAlert')} ({health.total_latency_ms} ms)
            </div>
          ) : null}

          <NodeGroup title={t('admin.health.microservicesGroup')} nodes={health.services} />
          <NodeGroup title={t('admin.health.workersGroup')} nodes={health.workers} />
          <NodeGroup title={t('admin.health.datastoresGroup')} nodes={health.datastores} />
        </>
      ) : null}
    </div>
  );
}
