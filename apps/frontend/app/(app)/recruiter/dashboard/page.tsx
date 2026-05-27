'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHeader, StatCard, ErrorBanner, SkeletonRow, StatusBadge } from '@/components/ui';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';
import { fetchJobs, type JobItem } from '@/lib/api/jobs';
import {
  fetchApplicationStatusSummary,
  fetchRankedApplications,
  fetchRecentStatusChanges,
  type ApplicationSummaryResponse,
  type RankedCandidateItem,
  type RecentStatusChangesResponse,
} from '@/lib/api/applications';

export default function RecruiterDashboardPage() {
  const header = usePageHeader('recruiterDashboard');
  const { t } = useTranslations();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [candidates, setCandidates] = useState<RankedCandidateItem[]>([]);
  const [summary, setSummary] = useState<ApplicationSummaryResponse['data'] | null>(null);
  const [changes, setChanges] = useState<RecentStatusChangesResponse['data']['changes']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchJobs({ limit: 50 })
      .then((payload) => {
        if (!active) return;
        setJobs(payload.data);
        const first = payload.data.find((job) => job.status === 'active') ?? payload.data[0];
        setSelectedJobId((current) => current || first?._id || '');
        setError(null);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : t('errors.loadDashboard'));
        setJobs([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (!selectedJobId) {
      setCandidates([]);
      setSummary(null);
      setChanges([]);
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all([
      fetchRankedApplications({ jobId: selectedJobId, limit: 5 }),
      fetchApplicationStatusSummary(selectedJobId),
      fetchRecentStatusChanges({ jobId: selectedJobId, limit: 5 }),
    ])
      .then(([ranked, summaryPayload, changesPayload]) => {
        if (!active) return;
        setCandidates(ranked.data.candidates);
        setSummary(summaryPayload.data);
        setChanges(changesPayload.data.changes);
        setError(null);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : t('errors.loadDashboard'));
        setCandidates([]);
        setSummary(null);
        setChanges([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedJobId, t]);

  const avgScore = useMemo(() => {
    if (!candidates.length) return 0;
    return Math.round(
      (candidates.reduce((acc, item) => acc + item.scores.hybrid_score, 0) / candidates.length) *
        100
    );
  }, [candidates]);

  const activeJobs = jobs.filter((job) => job.status === 'active').length;
  const totalApplicants = jobs.reduce((acc, job) => acc + (job.applications_count ?? 0), 0);
  const hiredCount = summary?.by_status?.hired ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title={header.title} subtitle={header.subtitle} />
      {error ? <ErrorBanner message={error} /> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('recruiter.dashboard.activeJobs')} value={String(activeJobs)} />
        <StatCard
          label={t('recruiter.dashboard.totalApplicants')}
          value={String(totalApplicants)}
        />
        <StatCard label={t('recruiter.dashboard.avgMatchScore')} value={`${avgScore}%`} />
        <StatCard label={t('recruiter.dashboard.hiredThisMonth')} value={String(hiredCount)} />
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
        <label className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
          {t('jobs.label')}
        </label>
        <select
          className="mt-2 w-full max-w-md rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          value={selectedJobId}
          onChange={(event) => setSelectedJobId(event.target.value)}
        >
          {jobs.map((job) => (
            <option key={job._id} value={job._id}>
              {job.title}
            </option>
          ))}
        </select>
      </div>
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t('recruiter.dashboard.recentApplications')}</h2>
          {selectedJobId ? (
            <Link
              className="text-xs font-semibold text-[var(--blue-700)]"
              href={`/recruiter/jobs/${selectedJobId}/candidates`}
            >
              {t('common.viewAll')}
            </Link>
          ) : null}
        </div>
        {loading ? (
          <div className="mt-4 space-y-3">
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : null}
        {!loading && candidates.length > 0 ? (
          <div className="mt-4 space-y-3">
            {candidates.map((candidate) => (
              <Link
                key={candidate.application_id}
                href={`/recruiter/jobs/${selectedJobId}/candidates/${candidate.application_id}`}
                className="grid gap-3 rounded-xl border border-[var(--border)] p-4 text-sm hover:bg-slate-50 md:grid-cols-[1fr_120px_120px] items-center"
              >
                <span>
                  <span className="block font-semibold">{candidate.candidate.full_name}</span>
                  <span className="text-xs text-[var(--text-3)]">{candidate.resume.title}</span>
                </span>
                <span className="font-mono text-left md:text-right font-semibold text-[var(--text-2)]">
                  {Math.round(candidate.scores.hybrid_score * 100)}%
                </span>
                <div className="flex justify-start md:justify-end">
                  <StatusBadge status={candidate.status} />
                </div>
              </Link>
            ))}
          </div>
        ) : null}
        {!loading && !candidates.length ? (
          <p className="mt-4 text-sm text-[var(--text-3)]">
            {t('emptyStates.noCandidatesFound.description')}
          </p>
        ) : null}
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-lg font-semibold">
          {t('recruiter.candidates.recentActivity', { count: changes.length })}
        </h2>
        <div className="mt-4 space-y-2">
          {changes.map((change) => (
            <div key={`${change.application_id}-${change.changed_at}`} className="text-sm">
              <span className="font-semibold">{change.candidate.full_name}</span>{' '}
              <span className="text-[var(--text-2)]">
                {change.from_status ? t(`status.${change.from_status}`) : '-'} {'->'}{' '}
                {t(`status.${change.to_status}`)}
              </span>
            </div>
          ))}
          {!changes.length && !loading ? (
            <p className="text-sm text-[var(--text-3)]">
              {t('recruiter.candidates.noRecentChanges')}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
