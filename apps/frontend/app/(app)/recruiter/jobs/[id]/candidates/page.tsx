'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AiStatusBadge,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  PageHeader,
  ScoreBar,
  SkeletonRow,
  StatusBadge,
} from '@/components/ui';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';
import {
  bulkUpdateApplicationStatus,
  fetchRankedApplications,
  type ApplicationAiStatus,
  type ApplicationStatus,
  type RankedCandidateItem,
} from '@/lib/api/applications';

const APPLICATION_STATUSES: ApplicationStatus[] = [
  'new',
  'screening',
  'interview',
  'offer',
  'hired',
  'rejected',
];
const AI_STATUSES: ApplicationAiStatus[] = ['pending', 'parsing', 'scoring', 'completed', 'failed'];

export default function RecruiterCandidatesPage() {
  const header = usePageHeader('recruiterCandidatesList');
  const { t } = useTranslations();
  const params = useParams();
  const jobId = params?.id as string;
  const [candidates, setCandidates] = useState<RankedCandidateItem[]>([]);
  const [jobTitle, setJobTitle] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  const [aiStatus, setAiStatus] = useState<ApplicationAiStatus | ''>('');
  const [minScore, setMinScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<ApplicationStatus>('screening');
  const [confirmBulk, setConfirmBulk] = useState(false);

  async function loadCandidates() {
    setLoading(true);
    try {
      const payload = await fetchRankedApplications({
        jobId,
        page,
        limit: 20,
        search,
        status,
        aiStatus,
        minScore,
        maxScore,
      });
      setCandidates(payload.data.candidates);
      setJobTitle(payload.data.job.title);
      setTotalPages(payload.data.pagination.total_pages || 1);
      setSelectedIds(new Set());
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.loadRankedCandidates'));
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, page, search, status, aiStatus, minScore, maxScore]);

  const allVisibleSelected = useMemo(
    () => candidates.length > 0 && candidates.every((item) => selectedIds.has(item.application_id)),
    [candidates, selectedIds]
  );

  function toggleAll() {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(candidates.map((item) => item.application_id)));
  }

  function toggleCandidate(applicationId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(applicationId)) next.delete(applicationId);
      else next.add(applicationId);
      return next;
    });
  }

  async function handleBulkUpdate() {
    if (selectedIds.size === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await bulkUpdateApplicationStatus({
        applicationIds: Array.from(selectedIds),
        status: bulkStatus,
      });
      setMessage(
        t('recruiter.candidates.bulkUpdated', { count: result.data.updated_count })
      );
      setConfirmBulk(false);
      await loadCandidates();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.bulkUpdateFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={jobTitle || header.title}
        subtitle={jobTitle ? header.subtitle : header.subtitle}
      />
      <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-white p-4">
        <input
          className="h-9 min-w-48 flex-1 rounded-lg border border-[var(--border)] px-3 text-sm"
          placeholder={t('recruiter.candidates.searchNameOrResume')}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as ApplicationStatus | '');
            setPage(1);
          }}
        >
          <option value="">{t('applications.allStatuses')}</option>
          {APPLICATION_STATUSES.map((item) => (
            <option key={item} value={item}>
              {t(`status.${item}`)}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
          value={aiStatus}
          onChange={(event) => {
            setAiStatus(event.target.value as ApplicationAiStatus | '');
            setPage(1);
          }}
        >
          <option value="">{t('applications.allAiStatuses')}</option>
          {AI_STATUSES.map((item) => (
            <option key={item} value={item}>
              {t(`aiStatus.${item}`)}
            </option>
          ))}
        </select>
        <input
          className="h-9 w-24 rounded-lg border border-[var(--border)] px-3 text-sm"
          placeholder={t('recruiter.candidates.minScore')}
          value={minScore}
          onChange={(event) => {
            setMinScore(event.target.value);
            setPage(1);
          }}
        />
        <input
          className="h-9 w-24 rounded-lg border border-[var(--border)] px-3 text-sm"
          placeholder={t('recruiter.candidates.maxScore')}
          value={maxScore}
          onChange={(event) => {
            setMaxScore(event.target.value);
            setPage(1);
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-white p-4">
        <span className="text-sm text-[var(--text-2)]">
          {t('recruiter.candidates.selectedCount', { count: selectedIds.size })}
        </span>
        <select
          className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
          value={bulkStatus}
          onChange={(event) => setBulkStatus(event.target.value as ApplicationStatus)}
        >
          {APPLICATION_STATUSES.map((item) => (
            <option key={item} value={item}>
              {t(`status.${item}`)}
            </option>
          ))}
        </select>
        <button
          className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          onClick={() => setConfirmBulk(true)}
          disabled={busy || selectedIds.size === 0}
          type="button"
        >
          {busy ? t('recruiter.candidates.updating') : t('recruiter.candidates.applyBulkAction')}
        </button>
      </div>
      {message ? (
        <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-[var(--success)]">
          {message}
        </p>
      ) : null}
      {loading ? <SkeletonRow /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!loading && !error && candidates.length === 0 ? (
        <EmptyState
          title={t('emptyStates.noCandidatesFound.title')}
          description={t('emptyStates.noCandidatesFound.description')}
        />
      ) : null}
      {!loading && !error && candidates.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAll}
              aria-label={t('recruiter.candidates.selectVisible')}
            />
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
              {t('recruiter.candidates.totalCandidates')}
            </span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {candidates.map((candidate) => (
              <div
                key={candidate.application_id}
                className="grid gap-4 px-4 py-4 text-sm md:grid-cols-[32px_1fr_180px_160px_120px]"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(candidate.application_id)}
                  onChange={() => toggleCandidate(candidate.application_id)}
                  aria-label={t('recruiter.candidates.selectCandidate', {
                    name: candidate.candidate.full_name,
                  })}
                />
                <div>
                  <p className="font-semibold">{candidate.candidate.full_name}</p>
                  <p className="text-xs text-[var(--text-3)]">{candidate.candidate.email}</p>
                  <p className="text-xs text-[var(--text-2)]">
                    {candidate.resume.title || t('recruiter.candidates.resumeFallback')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {candidate.explainability.matched_keywords.slice(0, 6).map((keyword) => (
                      <span key={keyword} className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] text-[var(--success)]">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <ScoreBar
                    label={t('scores.hybrid')}
                    value={candidate.scores.hybrid_score}
                    color="var(--gold)"
                  />
                  <ScoreBar
                    label={t('scores.semantic')}
                    value={candidate.scores.semantic_score}
                    color="var(--blue-600)"
                  />
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <StatusBadge status={candidate.status} />
                  <AiStatusBadge status={candidate.ai_status} />
                </div>
                <Link
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-center text-xs font-semibold text-[var(--blue-700)]"
                  href={`/recruiter/jobs/${jobId}/candidates/${candidate.application_id}`}
                >
                  {t('common.review')}
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {!loading && totalPages > 1 ? (
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
      <ConfirmDialog
        open={confirmBulk}
        title={t('dialogs.bulkUpdate.title')}
        description={t('dialogs.bulkUpdate.description', {
          count: selectedIds.size,
          status: t(`status.${bulkStatus}`),
        })}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        confirmVariant={bulkStatus === 'rejected' ? 'danger' : 'primary'}
        disabled={busy}
        onConfirm={() => void handleBulkUpdate()}
        onCancel={() => setConfirmBulk(false)}
      />
    </div>
  );
}
