'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader, ConfirmDialog, ErrorBanner, SkeletonRow } from '@/components/ui';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';
import {
  closeJob,
  deleteJob,
  fetchJobById,
  reopenJob,
  updateJob,
  type JobCategory,
  type JobItem,
  type JobStatus,
} from '@/lib/api/jobs';

const JOB_CATEGORIES: JobCategory[] = ['IT', 'Accounting', 'Marketing'];

type PendingAction = 'close' | 'reopen' | 'delete' | null;

export default function RecruiterJobEditPage() {
  const header = usePageHeader('recruiterJobsEdit');
  const { t } = useTranslations();
  const router = useRouter();
  const params = useParams();
  const jobId = params?.id as string;
  const [job, setJob] = useState<JobItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchJobById(jobId)
      .then((payload) => {
        if (!active) return;
        setJob(payload);
        setError(null);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : t('errors.loadJob'));
        setJob(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [jobId, t]);

  function update<K extends keyof JobItem>(key: K, value: JobItem[K]) {
    setJob((current) => (current ? { ...current, [key]: value } : current));
  }

  async function handleSave() {
    if (!job) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await updateJob(jobId, {
        title: job.title,
        category: job.category,
        location: job.location,
        experienceLevel: job.experienceLevel,
        applicationDeadline: job.applicationDeadline ?? null,
        description: job.description,
        requirements: job.requirements,
        benefits: job.benefits,
        status: job.status,
      });
      setJob(saved);
      setMessage(t('recruiter.jobs.jobUpdated'));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function confirmAction() {
    if (!pendingAction) return;
    setSaving(true);
    setError(null);
    try {
      if (pendingAction === 'close') {
        setJob(await closeJob(jobId));
      } else if (pendingAction === 'reopen') {
        setJob(await reopenJob(jobId));
      } else {
        await deleteJob(jobId);
        router.push('/recruiter/jobs');
      }
      setPendingAction(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.closeJob'));
    } finally {
      setSaving(false);
    }
  }

  const dialogTitle =
    pendingAction === 'delete'
      ? t('dialogs.deleteJobPosting.title')
      : pendingAction === 'reopen'
        ? t('dialogs.reopenJobPosting.title')
        : t('dialogs.closeJobPosting.title');
  const dialogDescription =
    pendingAction === 'delete'
      ? t('dialogs.deleteJobPosting.description', { title: job?.title ?? '' })
      : pendingAction === 'reopen'
        ? t('dialogs.reopenJobPosting.description', { title: job?.title ?? '' })
        : t('dialogs.closeJobPosting.description');

  return (
    <div className="space-y-6">
      <PageHeader title={header.title} subtitle={header.subtitle} />
      {loading ? <SkeletonRow /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {message ? (
        <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-[var(--success)]">
          {message}
        </p>
      ) : null}
      {!loading && job ? (
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5">
          <input
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            value={job.title}
            placeholder={t('forms.title')}
            onChange={(event) => update('title', event.target.value)}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              value={job.category}
              onChange={(event) => update('category', event.target.value as JobCategory)}
            >
              {JOB_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {t(`categories.${category}`)}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              value={job.status}
              onChange={(event) => update('status', event.target.value as JobStatus)}
            >
              <option value="active">{t('jobs.active')}</option>
              <option value="closed">{t('jobs.closed')}</option>
            </select>
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              value={job.location || ''}
              placeholder={t('forms.location')}
              onChange={(event) => update('location', event.target.value)}
            />
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              value={job.experienceLevel || ''}
              placeholder={t('forms.experienceLevel')}
              onChange={(event) => update('experienceLevel', event.target.value)}
            />
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm md:col-span-2"
              type="date"
              aria-label={t('jobs.deadline')}
              value={job.applicationDeadline?.slice(0, 10) ?? ''}
              onChange={(event) => update('applicationDeadline', event.target.value || null)}
            />
          </div>
          <textarea
            className="min-h-32 w-full rounded-lg border border-[var(--border)] p-3 text-sm"
            value={job.description}
            placeholder={t('forms.description')}
            onChange={(event) => update('description', event.target.value)}
          />
          <textarea
            className="min-h-28 w-full rounded-lg border border-[var(--border)] p-3 text-sm"
            value={job.requirements}
            placeholder={t('forms.requirements')}
            onChange={(event) => update('requirements', event.target.value)}
          />
          <textarea
            className="min-h-24 w-full rounded-lg border border-[var(--border)] p-3 text-sm"
            value={job.benefits || ''}
            placeholder={t('forms.benefits')}
            onChange={(event) => update('benefits', event.target.value)}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-60"
              onClick={() => setPendingAction(job.status === 'active' ? 'close' : 'reopen')}
              disabled={saving}
              type="button"
            >
              {job.status === 'active' ? t('common.close') : t('recruiter.jobs.reopen')}
            </button>
            <button
              className="rounded-lg border border-red-200 px-4 py-2 text-sm text-[var(--danger)] disabled:opacity-60"
              onClick={() => setPendingAction('delete')}
              disabled={saving}
              type="button"
            >
              {t('common.delete')}
            </button>
            <button
              className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white disabled:opacity-60"
              onClick={() => void handleSave()}
              disabled={saving}
              type="button"
            >
              {saving ? t('forms.saving') : t('common.save')}
            </button>
          </div>
        </section>
      ) : null}
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={dialogTitle}
        description={dialogDescription}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        confirmVariant={pendingAction === 'delete' ? 'danger' : 'primary'}
        disabled={saving}
        onConfirm={() => void confirmAction()}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
