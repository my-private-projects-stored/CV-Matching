'use client';

import { useEffect, useState } from 'react';
import { Briefcase, FileText, TrendingUp, Users } from 'lucide-react';
import { ErrorBanner, PageHeader, SkeletonRow, StatCard } from '@/components/ui';
import { fetchAnalyticsOverview, type AnalyticsOverviewResponse } from '@/lib/api/ops-analytics';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

export default function OwnerDashboardPage() {
  const header = usePageHeader('ownerDashboard');
  const { t } = useTranslations();
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [data, setData] = useState<AnalyticsOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAnalyticsOverview(range)
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

  const maxTrendValue = Math.max(
    1,
    ...(data?.series ?? []).map((pt) => Math.max(pt.users, pt.resumes, pt.jobs, pt.applications))
  );
  const categoryEntries = Object.entries(data?.categoryBreakdown ?? {});
  const maxCategoryValue = Math.max(1, ...categoryEntries.map(([, count]) => count));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title={header.title} subtitle={header.subtitle} />
        <div className="flex gap-2">
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
        </div>
      </div>

      {loading ? <SkeletonRow /> : null}
      {error ? <ErrorBanner message={error} /> : null}

      {!loading && !error && data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<Users className="size-4" />}
              label={t('owner.dashboard.totalUsers')}
              value={String(data.kpis.totalUsers)}
            />
            <StatCard
              icon={<FileText className="size-4" />}
              label={t('owner.dashboard.totalResumes')}
              value={String(data.kpis.totalResumes)}
            />
            <StatCard
              icon={<Briefcase className="size-4" />}
              label={t('owner.dashboard.activeJobs')}
              value={String(data.kpis.activeJobs)}
            />
            <StatCard
              icon={<TrendingUp className="size-4" />}
              label={t('owner.dashboard.totalApplications')}
              value={String(data.kpis.totalApplications)}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <h2 className="text-sm font-semibold text-[var(--text-1)]">
                {t('owner.dashboard.dailyTrend')}
              </h2>
              {data.series.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--text-3)]">{t('owner.noData')}</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {data.series.slice(-10).map((point) => (
                    <div key={point.date} className="space-y-1 text-xs">
                      <div className="flex justify-between text-[var(--text-2)]">
                        <span className="font-mono">{point.date}</span>
                        <span>
                          Apps: {point.applications} · Jobs: {point.jobs} · CVs: {point.resumes}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--blue-50)]">
                        <div
                          className="h-full rounded-full bg-[var(--blue-700)]"
                          style={{
                            width: `${Math.min(100, Math.round((point.applications / maxTrendValue) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <h2 className="text-sm font-semibold text-[var(--text-1)]">
                {t('owner.dashboard.categoryDistribution')}
              </h2>
              {categoryEntries.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--text-3)]">{t('owner.noData')}</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {categoryEntries.map(([category, count]) => (
                    <div key={category} className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium text-[var(--text-1)]">{category}</span>
                        <span className="font-semibold text-[var(--blue-700)]">{count}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--blue-50)]">
                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{ width: `${Math.round((count / maxCategoryValue) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 border-t border-[var(--border)] pt-4">
                <p className="text-xs font-semibold text-[var(--text-2)]">
                  {t('owner.dashboard.usersByRole')}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(data.kpis.usersByRole).map(([roleKey, count]) => (
                    <span
                      key={roleKey}
                      className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1 text-xs"
                    >
                      {roleKey}: <strong>{count}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
