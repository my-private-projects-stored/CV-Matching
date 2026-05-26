'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SkeletonCard, ErrorBanner } from '@/components/ui';
import { useTranslations } from '@/lib/i18n/translations';
import { fetchJobById, type JobItem } from '@/lib/api/jobs';
import { createApplication, fetchMyApplicationHistory } from '@/lib/api/applications';
import { fetchResumeList, type ResumeListItem } from '@/lib/api/resume';

export default function CandidateJobDetailPage() {
  const { t, locale } = useTranslations();
  const params = useParams();
  const jobId = params?.id as string;
  const [job, setJob] = useState<JobItem | null>(null);
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  function formatDeadline(value: string) {
    return new Date(value).toLocaleDateString(locale);
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchJobById(jobId),
      fetchResumeList(true),
      fetchMyApplicationHistory({ limit: 100 }).then((payload) => payload.data?.applications ?? []),
    ])
      .then(([jobData, resumeItems, applications]) => {
        if (!active) return;
        setJob(jobData);
        setAlreadyApplied(applications.some((item) => item.job?.id === jobId));
        setResumes(resumeItems);
        const master = resumeItems.find((r) => r.is_master);
        setSelectedResumeId(master?.resume_id || resumeItems[0]?.resume_id || '');
        setLoading(false);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : t('errors.loadJob'));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [jobId, t]);

  const canApply = Boolean(job?.status === 'active' && !alreadyApplied);

  async function handleApply() {
    if (!selectedResumeId || !jobId || !canApply) return;
    setApplyLoading(true);
    setApplyError(null);
    try {
      await createApplication({ job_id: jobId, resume_id: selectedResumeId });
      setApplySuccess(true);
      setAlreadyApplied(true);
      setTimeout(() => setShowApplyModal(false), 2000);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : t('errors.apply'));
    } finally {
      setApplyLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link className="text-sm text-[var(--blue-700)]" href="/candidate/jobs">
        {t('jobs.backToJobs')}
      </Link>
      {loading ? <SkeletonCard /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!loading && !error && job ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="font-display text-2xl">{job.title}</h1>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--text-2)]">
                    {job.location ? <span>📍 {job.location}</span> : null}
                    {job.experienceLevel ? <span>💼 {job.experienceLevel}</span> : null}
                    {job.applicationDeadline ? (
                      <span>
                        ⏰ {t('jobs.deadlineLabel', { date: formatDeadline(job.applicationDeadline) })}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-[var(--blue-50)] px-2 py-0.5 text-[var(--blue-700)]">
                      {t(`categories.${job.category}`)}
                    </span>
                  </div>
                </div>
                <button
                  className="rounded-lg bg-[var(--blue-700)] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                  onClick={() => {
                    setShowApplyModal(true);
                    setApplyError(null);
                    setApplySuccess(false);
                  }}
                  disabled={!canApply}
                  type="button"
                >
                  {alreadyApplied
                    ? t('jobs.alreadyApplied')
                    : job.status === 'active'
                      ? t('jobs.applyNow')
                      : t('jobs.closed')}
                </button>
              </div>
            </div>
            {job.description ? (
              <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-3)]">
                  {t('jobs.description')}
                </h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[var(--text-2)]">
                  {job.description}
                </p>
              </div>
            ) : null}
            {job.requirements ? (
              <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-3)]">
                  {t('jobs.requirements')}
                </h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[var(--text-2)]">
                  {job.requirements}
                </p>
              </div>
            ) : null}
            {job.benefits ? (
              <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-3)]">
                  {t('jobs.benefits')}
                </h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[var(--text-2)]">
                  {job.benefits}
                </p>
              </div>
            ) : null}
          </div>
          <aside className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
                {t('jobs.quickInfo')}
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-[var(--text-3)]">{t('jobs.category')}</dt>
                  <dd>{t(`categories.${job.category}`)}</dd>
                </div>
                {job.location ? (
                  <div>
                    <dt className="text-xs text-[var(--text-3)]">{t('forms.location')}</dt>
                    <dd>{job.location}</dd>
                  </div>
                ) : null}
                {job.experienceLevel ? (
                  <div>
                    <dt className="text-xs text-[var(--text-3)]">{t('jobs.experience')}</dt>
                    <dd>{job.experienceLevel}</dd>
                  </div>
                ) : null}
                {job.applicationDeadline ? (
                  <div>
                    <dt className="text-xs text-[var(--text-3)]">{t('jobs.deadline')}</dt>
                    <dd>{formatDeadline(job.applicationDeadline)}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs text-[var(--text-3)]">{t('jobs.status')}</dt>
                  <dd className={job.status === 'active' ? 'text-green-600' : 'text-gray-500'}>
                    {job.status === 'active'
                      ? t('jobs.acceptingApplications')
                      : t('jobs.closed')}
                  </dd>
                </div>
              </dl>
            </div>
            <button
              className="w-full rounded-lg bg-[var(--blue-700)] py-3 text-sm font-semibold text-white hover:opacity-90"
              onClick={() => {
                setShowApplyModal(true);
                setApplyError(null);
                setApplySuccess(false);
              }}
              disabled={!canApply}
              type="button"
            >
              {alreadyApplied
                ? t('jobs.alreadyApplied')
                : job.status === 'active'
                  ? t('jobs.applyNow')
                  : t('jobs.closed')}
            </button>
          </aside>
        </div>
      ) : null}
      {showApplyModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold">
              {t('jobs.applyForTitle', { title: job?.title ?? '' })}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-2)]">{t('jobs.selectResume')}</p>
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
                  <option key={r.resume_id} value={r.resume_id}>
                    {r.title || t('resumes.defaultTitle')}
                    {r.is_master ? t('forms.masterSuffix') : ''}
                  </option>
                ))}
              </select>
            )}
            {applyError ? <p className="mt-3 text-xs text-[var(--danger)]">{applyError}</p> : null}
            {applySuccess ? (
              <p className="mt-3 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-[var(--success)]">
                {t('jobs.applicationSubmittedShort')}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
                onClick={() => setShowApplyModal(false)}
                type="button"
              >
                {t('common.cancel')}
              </button>
              <button
                className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={handleApply}
                disabled={
                  applyLoading ||
                  !selectedResumeId ||
                  resumes.length === 0 ||
                  applySuccess ||
                  !canApply
                }
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
