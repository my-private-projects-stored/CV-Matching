'use client';

import { useEffect, useState } from 'react';
import { fetchHealth } from '@/lib/api/client';
import { useStatusCache } from '@/lib/context/status-cache';
import { useTranslations } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';

export function SystemHealthBadge({ className }: { className?: string }) {
  const { t } = useTranslations();
  const { status, isLoading: statusLoading } = useStatusCache();
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchHealth()
      .then((result) => {
        if (active) setHealthStatus(result.status);
      })
      .catch(() => {
        if (active) setHealthStatus('error');
      })
      .finally(() => {
        if (active) setHealthLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const apiHealthy = healthStatus === 'ok' || healthStatus === 'healthy';
  const systemReady = status?.status === 'ready';
  const llmHealthy = status?.llm_healthy ?? false;
  const loading = healthLoading || statusLoading;
  const llmLabel = status?.llm_health_stale
    ? `${t('admin.health.llm')} (${t('admin.health.stale')})`
    : status?.llm_health_checked_at
      ? `${t('admin.health.llm')} ${new Date(status.llm_health_checked_at).toLocaleString()}`
      : t('admin.health.llm');

  return (
    <div
      className={cn(
        'inline-flex flex-wrap items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs',
        className
      )}
    >
      <span className="font-semibold text-[var(--text-2)]">{t('admin.health.system')}</span>
      <HealthDot label={t('admin.health.api')} ok={apiHealthy} loading={loading} />
      <HealthDot label={t('admin.health.ready')} ok={systemReady} loading={loading} />
      <HealthDot label={llmLabel} ok={llmHealthy && !status?.llm_health_stale} loading={loading} />
    </div>
  );
}

function HealthDot({
  label,
  ok,
  loading,
}: {
  label: string;
  ok: boolean;
  loading: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[var(--text-3)]">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          loading ? 'bg-gray-300' : ok ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'
        )}
      />
      {label}
    </span>
  );
}
