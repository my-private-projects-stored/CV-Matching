'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState, ErrorBanner, SkeletonRow } from '@/components/ui';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';
import { fetchJobs, type JobItem, type JobCategory } from '@/lib/api/jobs';
import { createApplication, fetchMyApplicationHistory } from '@/lib/api/applications';
import { getList } from '@/lib/api';
import type { Resume } from '@/types';

const JOB_CATEGORIES: JobCategory[] = ['IT', 'Accounting', 'Marketing'];

export default function CandidateBrowseJobsPage() {
  const { t, locale } = useTranslations();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<JobCategory | ''>('');
  const [location, setLocation] = useState('');
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchJobs({ status: 'active', search, category, location, page, limit: 12 }),
      getList<Resume>('resumes', { limit: 20 }),
      fetchMyApplicationHistory({ limit: 100 }).then((payload) => payload.data?.applications ?? []),
    ])
      .then(([jobsRes, resumesRes, applications]) => {
        if (!active) return;
        setJobs(jobsRes.data);
        setTotalPages(jobsRes.pagination?.totalPages ?? 1);
        setAppliedJobIds(
          new Set(
            applications.map((item) => item.job?.id).filter((id): id is string => Boolean(id))
          )
        );
        const loadedResumes = resumesRes.data ?? [];
        setResumes(loadedResumes);
        const master = loadedResumes.find((r) => r.isMaster);
        setSelectedResumeId(master?._id || loadedResumes[0]?._id || '');
        setLoading(false);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : t('errors.loadJobs'));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category, location, page, search, t]);

  const filtered = useMemo(() => {
    return jobs;
  }, [jobs]);

  const pageHeader = usePageHeader('candidateJobs', { count: filtered.length });

  function formatDeadline(value: string) {
    return new Date(value).toLocaleDateString(locale);
  }

  async function handleApply() {
    if (!selectedResumeId || !applyingJobId) return;
    setApplyLoading(true);
    setApplyError(null);
    setApplySuccess(null);
    try {
      await createApplication({ job_id: applyingJobId, resume_id: selectedResumeId });
      setAppliedJobIds(new Set([...appliedJobIds, applyingJobId]));
      setApplySuccess(t('jobs.applicationSubmitted'));
      setTimeout(() => {
        setApplyingJobId(null);
        setApplySuccess(null);
      }, 2000);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : t('errors.apply'));
    } finally {
      setApplyLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={pageHeader.title} subtitle={pageHeader.subtitle} />
      <div className="flex flex-wrap gap-3 rounded-xl border border-[var(--border)] bg-white p-4">
        <input
          className="h-9 flex-1 min-w-40 rounded-lg border border-[var(--border)] px-3 text-sm"
          placeholder={t('common.searchJobs')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as JobCategory | '');
            setPage(1);
          }}
        >
          <option value="">{t('categories.all')}</option>
          {JOB_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {t(`categories.${value}`)}
            </option>
          ))}
        </select>
        <input
          className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
          placeholder={t('forms.location')}
          value={location}
          onChange={(e) => {
            setLocation(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {loading ? (
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!loading && !error && filtered.length === 0 ? (
        <EmptyState
          title={t('emptyStates.noJobsFound.title')}
          description={t('emptyStates.noJobsFound.description')}
        />
      ) : null}
      {!loading && !error ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((job) => (
            <div
              key={job._id}
              className="card-hover flex flex-col rounded-2xl border border-[var(--border)] bg-white p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--blue-50)] font-mono text-xs font-semibold text-[var(--blue-700)]">
                    {job.category.slice(0, 2).toUpperCase()}
                  </span>
                  <h3 className="text-sm font-semibold leading-snug">{job.title}</h3>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--blue-50)] px-2 py-0.5 text-xs text-[var(--blue-700)]">
                  {t(`categories.${job.category}`)}
                </span>
              </div>
              {job.location ? (
                <p className="mt-3 text-xs text-[var(--text-2)]">
                  {t('jobs.locationLabel', { location: job.location })}
                </p>
              ) : null}
              {job.experienceLevel ? (
                <p className="mt-0.5 text-xs text-[var(--text-3)]">
                  {t('jobs.experienceLabel', { level: job.experienceLevel })}
                </p>
              ) : null}
              {job.applicationDeadline ? (
                <p className="mt-0.5 text-xs text-[var(--text-3)]">
                  {t('jobs.deadlineLabel', { date: formatDeadline(job.applicationDeadline) })}
                </p>
              ) : null}
              <p className="mt-3 line-clamp-3 text-xs text-[var(--text-2)] leading-5">
                {job.description}
              </p>
              <div className="mt-4 flex gap-2">
                <a
                  className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-center text-xs hover:bg-gray-50"
                  href={`/candidate/jobs/${job._id}`}
                >
                  {t('jobs.viewDetails')}
                </a>
                <button
                  className="flex-1 rounded-lg bg-[var(--blue-700)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                  onClick={() => {
                    setApplyingJobId(job._id);
                    setApplyError(null);
                    setApplySuccess(null);
                  }}
                  disabled={appliedJobIds.has(job._id)}
                  type="button"
                >
                  {appliedJobIds.has(job._id) ? t('jobs.applied') : t('common.apply')}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {!loading && !error && totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <button
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            {t('pagination.previous')}
          </button>
          <span className="text-xs text-[var(--text-2)]">
            {t('pagination.pageOf', { page, totalPages })}
          </span>
          <button
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            type="button"
          >
            {t('pagination.next')}
          </button>
        </div>
      ) : null}
      {applyingJobId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold">{t('jobs.applyForPosition')}</h2>
            <p className="mt-1 text-sm text-[var(--text-2)]">{t('jobs.selectResumeToApply')}</p>
            {resumes.length === 0 ? (
              <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {t('jobs.noResumesYet')}{' '}
                <a href="/candidate/resumes" className="underline">
                  {t('jobs.uploadFirst')}
                </a>
              </div>
            ) : (
              <select
                className="mt-4 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
              >
                {resumes.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.title || t('resumes.defaultTitle')}
                    {r.isMaster ? t('forms.masterSuffix') : ''}
                  </option>
                ))}
              </select>
            )}
            {applyError ? (
              <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-[var(--danger)]">
                {applyError}
              </p>
            ) : null}
            {applySuccess ? (
              <p className="mt-3 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-[var(--success)]">
                {applySuccess}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
                onClick={() => setApplyingJobId(null)}
                type="button"
              >
                {t('common.cancel')}
              </button>
              <button
                className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={handleApply}
                disabled={applyLoading || !selectedResumeId || resumes.length === 0}
                type="button"
              >
                {applyLoading ? t('jobs.submitting') : t('jobs.submitApplication')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
