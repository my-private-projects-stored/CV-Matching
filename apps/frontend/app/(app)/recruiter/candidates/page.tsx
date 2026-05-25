'use client';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Users } from 'lucide-react';
import { EmptyState, ErrorBanner, PageHeader, SkeletonRow, StatCard } from '@/components/ui';
import { fetchJobs, type JobItem, type JobStatus } from '@/lib/api/jobs';

export default function RecruiterAllCandidatesPage() {
  const header = usePageHeader('recruiterCandidates');
  const { t } = useTranslations();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<JobStatus | ''>('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchJobs({ limit: 100, status })
      .then((res) => {
        if (!active) return;
        setJobs(res.data);
        setError(null);
      })
      .catch((requestError: Error) => {
        if (!active) return;
        setJobs([]);
        setError(requestError.message || t('errors.loadJobs'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [status]);

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return jobs;
    return jobs.filter((job) =>
      `${job.title} ${job.category} ${job.location}`.toLowerCase().includes(query)
    );
  }, [jobs, search]);

  const totalCandidates = jobs.reduce((total, job) => total + (job.applications_count ?? 0), 0);
  const activeJobs = jobs.filter((job) => job.status === 'active').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={header.title}
        subtitle={header.subtitle}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          icon={<Users className="size-4" />}
          label={t('recruiter.candidates.totalCandidates')}
          value={String(totalCandidates)}
        />
        <StatCard
          icon={<Briefcase className="size-4" />}
          label={t('recruiter.dashboard.activeJobs')}
          value={String(activeJobs)}
        />
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-white p-4">
        <input
          className="h-9 min-w-48 flex-1 rounded-lg border border-[var(--border)] px-3 text-sm"
          placeholder={t('common.search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value as JobStatus | '')}
        >
          <option value="">{t('jobs.filtersAllStatuses')}</option>
          <option value="active">{t('jobs.active')}</option>
          <option value="closed">{t('jobs.closed')}</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!loading && !error && filteredJobs.length === 0 ? (
        <EmptyState
          title={t('emptyStates.noJobsForCandidates.title')}
          description={t('emptyStates.noJobsForCandidates.description')}
          action={
            <Link
              className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm font-semibold text-white"
              href="/recruiter/jobs/new"
            >
              {t('emptyStates.noJobsForCandidates.action')}
            </Link>
          }
        />
      ) : null}

      {!loading && !error && filteredJobs.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredJobs.map((job) => (
            <Link
              key={job._id}
              className="card-hover rounded-2xl border border-[var(--border)] bg-white p-5"
              href={`/recruiter/jobs/${job._id}/candidates`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-1)]">{job.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-2)]">
                    {[t(`categories.${job.category}`), job.location].filter(Boolean).join(' - ') ||
                      t('recruiter.candidates.jobPostingFallback')}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--blue-50)] px-2 py-1 text-xs font-semibold text-[var(--blue-700)]">
                  {job.status === 'active' ? t('jobs.active') : t('jobs.closed')}
                </span>
              </div>
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <p className="font-display text-3xl">{job.applications_count ?? 0}</p>
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-3)]">
                    {t('recruiter.candidates.candidatesLabel')}
                  </p>
                </div>
                <span className="text-xs font-semibold text-[var(--blue-700)]">
                  {t('recruiter.candidates.review')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
