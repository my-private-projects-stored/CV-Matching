'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  StatCard,
  StatusBadge,
  AiStatusBadge,
  ScoreBar,
  SkeletonRow,
  ErrorBanner,
  EmptyState,
} from '@/components/ui';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';
import {
  fetchMyApplicationHistory,
  type ApplicationAiStatus,
  type CandidateHistoryItem,
} from '@/lib/api/applications';

const pendingAiStatuses = new Set<ApplicationAiStatus>(['pending', 'parsing', 'scoring']);

export default function CandidateDashboardPage() {
  const header = usePageHeader('candidateDashboard');
  const { t, locale } = useTranslations();
  const [applications, setApplications] = useState<CandidateHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchMyApplicationHistory({ limit: 10 })
      .then((payload) => {
        if (!active) return;
        setApplications(payload.data.applications);
        setTotal(payload.data.pagination.total);
        setError(null);
      })
      .catch((requestError) => {
        if (!active) return;
        setApplications([]);
        setTotal(0);
        setError(requestError instanceof Error ? requestError.message : t('errors.loadDashboard'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const stats = useMemo(() => {
    const loaded = applications.length;
    const avgScore = loaded
      ? Math.round(
          (applications.reduce((acc, item) => acc + (item.scores?.hybrid_score ?? 0), 0) /
            loaded) *
            100
        )
      : 0;
    const interviews = applications.filter((item) => item.status === 'interview').length;
    const pendingAi = applications.filter((item) => pendingAiStatuses.has(item.ai_status)).length;
    return { total, avgScore, interviews, pendingAi };
  }, [applications, total]);

  const recent = applications.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader title={header.title} subtitle={header.subtitle} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('applications.statsApplicationsSent')} value={String(stats.total)} />
        <StatCard label={t('applications.statsAvgMatchScore')} value={`${stats.avgScore}%`} />
        <StatCard label={t('applications.statsInterviews')} value={String(stats.interviews)} />
        <StatCard label={t('applications.statsPendingAi')} value={String(stats.pendingAi)} />
      </div>
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('applications.recentApplications')}</h2>
          <Link className="text-sm text-[var(--blue-700)]" href="/candidate/applications">
            {t('common.viewAll')}
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : null}
          {error ? <ErrorBanner message={error} /> : null}
          {!loading && !error && recent.length === 0 ? (
            <EmptyState
              title={t('emptyStates.noApplicationsYet.title')}
              description={t('emptyStates.noApplicationsYet.description')}
            />
          ) : null}
          {!loading && !error
            ? recent.map((item) => (
                <Link
                  key={item.application_id}
                  href={`/candidate/applications/${item.application_id}`}
                  className="grid gap-3 rounded-xl border border-[var(--border)] p-4 transition hover:border-[var(--blue-700)] md:grid-cols-[2fr_1fr_1fr]"
                >
                  <div>
                    <p className="text-sm font-semibold">{item.job.title}</p>
                    <p className="text-xs text-[var(--text-2)]">
                      {[item.job.location, item.resume.title].filter(Boolean).join(' - ') ||
                        new Date(item.submitted_at).toLocaleDateString(locale)}
                    </p>
                  </div>
                  <ScoreBar
                    label={t('applications.hybridLabel')}
                    value={item.scores?.hybrid_score ?? 0}
                    color="var(--gold)"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <AiStatusBadge status={item.ai_status} />
                    <StatusBadge status={item.status} />
                  </div>
                </Link>
              ))
            : null}
        </div>
      </section>
    </div>
  );
}
