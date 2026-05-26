'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, ErrorBanner } from '@/components/ui';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';
import { createJob, type CreateJobPayload, type JobCategory, type JobStatus } from '@/lib/api/jobs';

const JOB_CATEGORIES: JobCategory[] = ['IT', 'Accounting', 'Marketing'];

const INITIAL_FORM: CreateJobPayload = {
  title: '',
  category: 'IT',
  location: '',
  experienceLevel: '',
  applicationDeadline: null,
  description: '',
  requirements: '',
  benefits: '',
  status: 'active',
};

export default function RecruiterJobNewPage() {
  const header = usePageHeader('recruiterJobsNew');
  const { t } = useTranslations();
  const router = useRouter();
  const [form, setForm] = useState<CreateJobPayload>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const keywordPreview = useMemo(() => {
    const words = `${form.title} ${form.description} ${form.requirements}`
      .toLowerCase()
      .replace(/[^a-z0-9\s+#.]/g, ' ')
      .split(/\s+/)
      .filter((item) => item.length > 3);
    return Array.from(new Set(words)).slice(0, 12);
  }, [form.description, form.requirements, form.title]);

  function update<K extends keyof CreateJobPayload>(key: K, value: CreateJobPayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const created = await createJob(form);
      router.push(`/recruiter/jobs/${created._id}/candidates`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.loadJobs'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={header.title} subtitle={header.subtitle} />
      {error ? <ErrorBanner message={error} /> : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5">
          <input
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder={t('forms.title')}
            value={form.title}
            onChange={(event) => update('title', event.target.value)}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              value={form.category}
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
              value={form.status}
              onChange={(event) => update('status', event.target.value as JobStatus)}
            >
              <option value="active">{t('jobs.active')}</option>
              <option value="closed">{t('jobs.closed')}</option>
            </select>
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              placeholder={t('forms.location')}
              value={form.location}
              onChange={(event) => update('location', event.target.value)}
            />
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              placeholder={t('forms.experienceLevel')}
              value={form.experienceLevel}
              onChange={(event) => update('experienceLevel', event.target.value)}
            />
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm md:col-span-2"
              type="date"
              aria-label={t('jobs.deadline')}
              value={form.applicationDeadline?.slice(0, 10) ?? ''}
              onChange={(event) => update('applicationDeadline', event.target.value || null)}
            />
          </div>
          <textarea
            className="min-h-32 w-full rounded-lg border border-[var(--border)] p-3 text-sm"
            placeholder={t('forms.description')}
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
          />
          <textarea
            className="min-h-28 w-full rounded-lg border border-[var(--border)] p-3 text-sm"
            placeholder={t('forms.requirements')}
            value={form.requirements}
            onChange={(event) => update('requirements', event.target.value)}
          />
          <textarea
            className="min-h-24 w-full rounded-lg border border-[var(--border)] p-3 text-sm"
            placeholder={t('forms.benefits')}
            value={form.benefits}
            onChange={(event) => update('benefits', event.target.value)}
          />
          <div className="flex justify-end">
            <button
              className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white disabled:opacity-60"
              onClick={() => void handleSubmit()}
              disabled={loading || !form.title.trim() || !form.description.trim() || !form.requirements.trim()}
              type="button"
            >
              {loading ? t('recruiter.jobs.publishing') : t('recruiter.jobs.publishJob')}
            </button>
          </div>
        </section>
        <aside className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <p className="text-sm font-semibold">{t('recruiter.jobs.preview')}</p>
          <h2 className="mt-3 text-base font-semibold">
            {form.title || t('recruiter.jobs.jobTitleFallback')}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-3)]">
            {t(`categories.${form.category}`)} / {form.location || t('forms.location')}
          </p>
          <p className="mt-3 line-clamp-6 text-sm text-[var(--text-2)]">
            {form.description || t('recruiter.jobs.descriptionPreviewFallback')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {keywordPreview.map((keyword) => (
              <span key={keyword} className="rounded-full bg-[var(--blue-50)] px-2 py-1 text-xs text-[var(--blue-700)]">
                {keyword}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs text-[var(--text-3)]">
            {t('recruiter.jobs.charsCount', {
              count: form.description.length + form.requirements.length,
            })}
          </p>
        </aside>
      </div>
    </div>
  );
}
