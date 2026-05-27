'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader, EmptyState, ErrorBanner, SkeletonRow, ConfirmDialog } from '@/components/ui';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';
import {
  closeJob,
  deleteJob,
  fetchJobs,
  reopenJob,
  type JobCategory,
  type JobItem,
  type JobStatus,
} from '@/lib/api/jobs';

const JOB_CATEGORIES: JobCategory[] = ['IT', 'Accounting', 'Marketing'];

type PendingAction =
  | { type: 'close'; job: JobItem }
  | { type: 'reopen'; job: JobItem }
  | { type: 'delete'; job: JobItem }
  | null;

export default function RecruiterJobsPage() {
  const header = usePageHeader('recruiterJobs');
  const { t, locale } = useTranslations();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<JobStatus | ''>('');
  const [category, setCategory] = useState<JobCategory | ''>('');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  async function loadJobs() {
    setLoading(true);
    try {
      const payload = await fetchJobs({ search, status, category, limit: 50 });
      setJobs(payload.data);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.loadJobs'));
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, category]);

  async function confirmAction() {
    if (!pendingAction) return;
    setBusy(true);
    setError(null);
    try {
      if (pendingAction.type === 'close') {
        await closeJob(pendingAction.job._id);
      } else if (pendingAction.type === 'reopen') {
        await reopenJob(pendingAction.job._id);
      } else {
        await deleteJob(pendingAction.job._id);
      }
      setPendingAction(null);
      await loadJobs();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.closeJob'));
    } finally {
      setBusy(false);
    }
  }

  function formatDate(value?: string | null) {
    return value ? new Date(value).toLocaleDateString(locale) : '-';
  }

  const dialogTitle =
    pendingAction?.type === 'delete'
      ? t('dialogs.deleteJobPosting.title')
      : pendingAction?.type === 'reopen'
        ? t('dialogs.reopenJobPosting.title')
        : t('dialogs.closeJobPosting.title');
  const dialogDescription =
    pendingAction?.type === 'delete'
      ? t('dialogs.deleteJobPosting.description', { title: pendingAction.job.title })
      : pendingAction?.type === 'reopen'
        ? t('dialogs.reopenJobPosting.description', { title: pendingAction.job.title })
        : t('dialogs.closeJobPosting.description');

  return (
    <div className="space-y-6">
      <PageHeader
        title={header.title}
        subtitle={header.subtitle}
        action={
          <Link
            className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white"
            href="/recruiter/jobs/new"
          >
            {t('recruiter.jobs.postNewJob')}
          </Link>
        }
      />
      <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-white p-4">
        <input
          className="h-9 min-w-48 flex-1 rounded-lg border border-[var(--border)] px-3 text-sm"
          placeholder={t('recruiter.jobs.searchTitle')}
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
        <select
          className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
          value={category}
          onChange={(event) => setCategory(event.target.value as JobCategory | '')}
        >
          <option value="">{t('jobs.filtersAllCategories')}</option>
          {JOB_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {t(`categories.${item}`)}
            </option>
          ))}
        </select>
      </div>
      {loading ? <SkeletonRow /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!loading && !error && jobs.length === 0 ? (
        <EmptyState
          title={t('emptyStates.noJobPostings.title')}
          description={t('emptyStates.noJobPostings.description')}
        />
      ) : null}
      {!loading && !error && jobs.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
          <div className="grid grid-cols-[1.5fr_1fr_1fr_0.8fr_0.8fr_1.6fr] gap-3 border-b border-[var(--border)] px-4 py-3 text-xs font-semibold text-[var(--text-3)]">
            <span>{t('recruiter.jobs.tableTitle')}</span>
            <span>{t('recruiter.jobs.tableCategory')}</span>
            <span>{t('recruiter.jobs.tableLocation')}</span>
            <span>{t('recruiter.jobs.tableStatus')}</span>
            <span>{t('recruiter.jobs.tableDeadline')}</span>
            <span>{t('recruiter.jobs.tableActions')}</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {jobs.map((job) => (
              <div
                key={job._id}
                className="grid grid-cols-[1.5fr_1fr_1fr_0.8fr_0.8fr_1.6fr] gap-3 px-4 py-3 text-sm"
              >
                <span className="font-semibold">{job.title}</span>
                <span>{t(`categories.${job.category}`)}</span>
                <span>{job.location || '-'}</span>
                <span>{job.status === 'active' ? t('jobs.active') : t('jobs.closed')}</span>
                <span>{formatDate(job.applicationDeadline)}</span>
                <span className="flex flex-wrap gap-2">
                  <Link
                    className="text-[var(--blue-700)]"
                    href={`/recruiter/jobs/${job._id}/candidates`}
                  >
                    {t('recruiter.jobs.candidatesLink')}
                  </Link>
                  <Link
                    className="text-[var(--blue-700)]"
                    href={`/recruiter/jobs/${job._id}/find-candidates`}
                  >
                    {t('recruiter.jobs.findCvs')}
                  </Link>
                  <Link className="text-[var(--blue-700)]" href={`/recruiter/jobs/${job._id}/edit`}>
                    {t('common.edit')}
                  </Link>
                  <button
                    className="text-[var(--warning)] disabled:opacity-50"
                    onClick={() =>
                      setPendingAction({ type: job.status === 'active' ? 'close' : 'reopen', job })
                    }
                    disabled={busy}
                    type="button"
                  >
                    {job.status === 'active' ? t('common.close') : t('recruiter.jobs.reopen')}
                  </button>
                  <button
                    className="text-[var(--danger)] disabled:opacity-50"
                    onClick={() => setPendingAction({ type: 'delete', job })}
                    disabled={busy}
                    type="button"
                  >
                    {t('common.delete')}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={dialogTitle}
        description={dialogDescription}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        confirmVariant={pendingAction?.type === 'delete' ? 'danger' : 'primary'}
        disabled={busy}
        onConfirm={() => void confirmAction()}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
