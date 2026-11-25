'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { ErrorBanner, PageHeader, SkeletonRow } from '@/components/ui';
import {
  downloadAnalyticsCsv,
  fetchAnalyticsFunnel,
  type AnalyticsFunnelResponse,
} from '@/lib/api/ops-analytics';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

const FUNNEL_STAGES = ['new', 'screening', 'interview', 'offer', 'hired'] as const;

export default function OwnerFunnelPage() {
  const header = usePageHeader('ownerFunnel');
  const { t } = useTranslations();
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [data, setData] = useState<AnalyticsFunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAnalyticsFunnel(range)
      .then((res) => {
        if (!active) return;
        setData(res);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : t('errors.loadAnalytics'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [range, t]);

  async function handleExportCsv() {
    setExporting(true);
    try {
      const csv = await downloadAnalyticsCsv(range);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `platform-funnel-${range}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.loadAnalytics'));
    } finally {
      setExporting(false);
    }
  }

  const maxStage = Math.max(1, ...(data ? Object.values(data.stageCounts) : [1]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title={header.title} subtitle={header.subtitle} />
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setRange(opt)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                range === opt
                  ? 'border-[var(--blue-700)] bg-[var(--blue-700)] text-white'
                  : 'border-[var(--border)] bg-white text-[var(--text-2)]'
              }`}
            >
              {opt.toUpperCase()}
            </button>
          ))}
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExportCsv()}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--blue-700)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Download className="size-3.5" />
            {t('owner.funnel.exportCsv')}
          </button>
        </div>
      </div>

      {loading ? <SkeletonRow /> : null}
      {error ? <ErrorBanner message={error} /> : null}

      {!loading && !error && data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <h2 className="text-sm font-semibold text-[var(--text-1)]">
              {t('owner.funnel.stageTitle')}
            </h2>
            <div className="mt-4 space-y-3">
              {FUNNEL_STAGES.map((stage) => {
                const count = data.stageCounts[stage] ?? 0;
                return (
                  <div key={stage} className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium capitalize text-[var(--text-1)]">
                        {t(`status.${stage}`)}
                      </span>
                      <span className="font-semibold text-[var(--blue-700)]">{count}</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--blue-50)]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--blue-700)] to-[var(--blue-500)] transition-all duration-300"
                        style={{ width: `${Math.round((count / maxStage) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-4 pt-2 text-xs text-[var(--text-2)]">
                <span>
                  {t('status.rejected')}: <strong>{data.stageCounts.rejected ?? 0}</strong>
                </span>
                <span>
                  {t('status.withdrawn')}: <strong>{data.stageCounts.withdrawn ?? 0}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <h2 className="text-sm font-semibold text-[var(--text-1)]">
              {t('owner.funnel.aiCorrelationTitle')}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-2)]">
              {t('owner.funnel.aiCorrelationSubtitle')}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold text-emerald-800">
                  {t('owner.funnel.highScoreGroup')} (≥ 80%)
                </p>
                <p className="mt-2 text-2xl font-bold text-emerald-900">
                  {data.aiCorrelation.highScoreGroup.hireRate}%
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  {t('owner.funnel.interviewRate')}:{' '}
                  {data.aiCorrelation.highScoreGroup.interviewRate}% (n=
                  {data.aiCorrelation.highScoreGroup.count})
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-800">
                  {t('owner.funnel.lowScoreGroup')} (&lt; 50%)
                </p>
                <p className="mt-2 text-2xl font-bold text-amber-900">
                  {data.aiCorrelation.lowScoreGroup.hireRate}%
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  {t('owner.funnel.interviewRate')}:{' '}
                  {data.aiCorrelation.lowScoreGroup.interviewRate}% (n=
                  {data.aiCorrelation.lowScoreGroup.count})
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
