'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  EmptyState,
  ErrorBanner,
  SkeletonRow,
  ScoreBar,
  AiStatusBadge,
  StatusBadge,
} from '@/components/ui';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';
import {
  fetchMyApplicationHistory,
  type ApplicationAiStatus,
  type ApplicationStatus,
  type CandidateHistoryItem,
} from '@/lib/api/applications';

const STATUS_OPTIONS: ApplicationStatus[] = [
  'new',
  'screening',
  'interview',
  'offer',
  'hired',
  'rejected',
];
const AI_STATUS_OPTIONS: ApplicationAiStatus[] = [
  'pending',
  'parsing',
  'scoring',
  'completed',
  'failed',
];

export default function CandidateApplicationsPage() {
  const header = usePageHeader('candidateApplications');
  const { t, locale } = useTranslations();
  const [applications, setApplications] = useState<CandidateHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  const [aiStatus, setAiStatus] = useState<ApplicationAiStatus | ''>('');
  const [submittedAfter, setSubmittedAfter] = useState('');
  const [submittedBefore, setSubmittedBefore] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchMyApplicationHistory({
      page,
      limit: 20,
      status,
      aiStatus,
      search,
      submittedAfter,
      submittedBefore,
    })
      .then((payload) => {
        if (!active) return;
        setApplications(payload.data.applications);
        setTotalPages(payload.data.pagination.total_pages || 1);
        setError(null);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : t('errors.loadApplication'));
        setApplications([]);
        setTotalPages(1);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [aiStatus, page, search, status, submittedAfter, submittedBefore, t]);

  function resetPage() {
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={header.title} subtitle={header.subtitle} />
      <div className="grid gap-2 rounded-xl border border-[var(--border)] bg-white p-4 md:grid-cols-[1fr_auto_auto_auto_auto]">
        <input
          className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
          placeholder={t('forms.searchJobOrResume')}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            resetPage();
          }}
        />
        <select
          className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as ApplicationStatus | '');
            resetPage();
          }}
        >
          <option value="">{t('applications.allStatuses')}</option>
          {STATUS_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {t(`status.${value}`)}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
          value={aiStatus}
          onChange={(event) => {
            setAiStatus(event.target.value as ApplicationAiStatus | '');
            resetPage();
          }}
        >
          <option value="">{t('applications.allAiStatuses')}</option>
          {AI_STATUS_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {t(`aiStatus.${value}`)}
            </option>
          ))}
        </select>
        <input
          className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
          type="date"
          value={submittedAfter}
          onChange={(event) => {
            setSubmittedAfter(event.target.value);
            resetPage();
          }}
          aria-label={t('applications.submittedAfter')}
        />
        <input
          className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
          type="date"
          value={submittedBefore}
          onChange={(event) => {
            setSubmittedBefore(event.target.value);
            resetPage();
          }}
          aria-label={t('applications.submittedBefore')}
        />
      </div>
      {loading ? (
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!loading && !error && applications.length === 0 ? (
        <EmptyState
          title={t('emptyStates.noApplicationsFound.title')}
          description={t('emptyStates.noApplicationsFound.description')}
        />
      ) : null}
      {!loading && !error ? (
        <div className="space-y-3">
          {applications.map((item) => (
            <div
              key={item.application_id}
              className="rounded-xl border border-[var(--border)] bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{item.job.title}</p>
                  <p className="text-xs text-[var(--text-2)]">
                    {t('applications.appliedOn', {
                      date: new Date(item.submitted_at).toLocaleDateString(locale),
                    })}
                    {item.job.location ? ` - ${item.job.location}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AiStatusBadge status={item.ai_status} />
                  <StatusBadge status={item.status} />
                </div>
              </div>
              <div className="mt-3">
                <ScoreBar
                  label={t('applications.hybridLabel')}
                  value={item.scores?.hybrid_score ?? 0}
                  color="var(--gold)"
                />
              </div>
              <div className="mt-3 flex justify-end">
                <Link
                  className="text-xs text-[var(--blue-700)]"
                  href={`/candidate/applications/${item.application_id}`}
                >
                  {t('applications.viewFeedback')}
                </Link>
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
    </div>
  );
}
