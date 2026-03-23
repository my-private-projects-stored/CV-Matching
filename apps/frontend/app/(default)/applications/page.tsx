'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from '@/lib/i18n';

import {
  fetchApplicationFeedback,
  fetchCandidateApplicationHistory,
  fetchRecentStatusChanges,
  fetchApplicationStatusHistory,
  fetchApplicationStatusSummary,
  fetchRankedApplications,
  updateApplicationStatus,
  type ApplicationAiStatus,
  type ApplicationFeedbackResponse,
  type ApplicationStatus,
  type CandidateHistoryItem,
  type RankedCandidateItem,
} from '@/lib/api/applications';
import { getOriginalResumeDownloadUrl } from '@/lib/api/resume';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const STATUS_OPTIONS: ApplicationStatus[] = ['new', 'screening', 'interview', 'hired', 'rejected'];
const AI_STATUS_OPTIONS: ApplicationAiStatus[] = ['pending', 'parsing', 'scoring', 'completed', 'failed'];

function badgeClass(status: ApplicationStatus): string {
  switch (status) {
    case 'hired':
      return 'bg-green-100 text-green-800 border-green-400';
    case 'rejected':
      return 'bg-red-100 text-red-800 border-red-400';
    case 'interview':
      return 'bg-blue-100 text-blue-800 border-blue-400';
    case 'screening':
      return 'bg-amber-100 text-amber-800 border-amber-400';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-400';
  }
}

export default function ApplicationsPage() {
  const { t } = useTranslations();
  const searchParams = useSearchParams();
  const defaultJobId = searchParams.get('job_id') || '';
  const defaultCandidateId = searchParams.get('candidate_id') || '';

  const [jobId, setJobId] = useState(defaultJobId);
  const [candidateId, setCandidateId] = useState(defaultCandidateId);
  const [rankedStatusFilter, setRankedStatusFilter] = useState<ApplicationStatus | ''>('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<ApplicationStatus | ''>('');
  const [rankedItems, setRankedItems] = useState<RankedCandidateItem[]>([]);
  const [historyItems, setHistoryItems] = useState<CandidateHistoryItem[]>([]);
  const [feedback, setFeedback] = useState<ApplicationFeedbackResponse['data'] | null>(null);
  const [selectedStatusHistory, setSelectedStatusHistory] = useState<{
    applicationId: string;
    candidateName: string;
    currentStatus: ApplicationStatus;
    entries: Array<{
      from_status: ApplicationStatus | null;
      to_status: ApplicationStatus;
      changed_at: string;
      changed_by: string;
    }>;
  } | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    by_status: Record<ApplicationStatus, number>;
    by_ai_status: Record<ApplicationAiStatus, number>;
  } | null>(null);
  const [rankedPage, setRankedPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [rankedTotalPages, setRankedTotalPages] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [rankedActivated, setRankedActivated] = useState(Boolean(defaultJobId));
  const [historyActivated, setHistoryActivated] = useState(Boolean(defaultCandidateId));
  const [isLoadingRanked, setIsLoadingRanked] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingStatusChanges, setIsLoadingStatusChanges] = useState(false);
  const [statusChanges, setStatusChanges] = useState<
    Array<{
      application_id: string;
      candidate: {
        id: string | null;
        full_name: string;
        email: string;
      };
      from_status: ApplicationStatus | null;
      to_status: ApplicationStatus;
      changed_at: string;
      changed_by: string;
      current_status: ApplicationStatus;
    }>
  >([]);
  const [statusChangesFilter, setStatusChangesFilter] = useState<ApplicationStatus | ''>('');
  const [statusChangesChangedBy, setStatusChangesChangedBy] = useState('');
  const [statusChangesChangedAfter, setStatusChangesChangedAfter] = useState('');
  const [statusChangesChangedBefore, setStatusChangesChangedBefore] = useState('');
  const [statusChangesPreset, setStatusChangesPreset] = useState<'' | '7d' | '30d' | '90d'>('');
  const [statusChangesPage, setStatusChangesPage] = useState(1);
  const [statusChangesTotalPages, setStatusChangesTotalPages] = useState(1);
  const [statusChangesTotal, setStatusChangesTotal] = useState(0);
  const [statusChangesActivated, setStatusChangesActivated] = useState(Boolean(defaultJobId));
  const [error, setError] = useState<string | null>(null);

  const topHybrid = useMemo(() => {
    if (!rankedItems.length) return null;
    return rankedItems[0].scores.hybrid_score;
  }, [rankedItems]);

  const statusLabel = useCallback(
    (status: ApplicationStatus) => t(`applicationsPage.status.${status}`),
    [t]
  );

  const applyStatusChangesPreset = useCallback((preset: '7d' | '30d' | '90d') => {
    const days = Number.parseInt(preset.replace('d', ''), 10);
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - (days - 1));

    setStatusChangesPreset(preset);
    setStatusChangesChangedAfter(from.toISOString().slice(0, 10));
    setStatusChangesChangedBefore(today.toISOString().slice(0, 10));
    setStatusChangesPage(1);
  }, []);

  const aiStatusLabel = useCallback(
    (status: ApplicationAiStatus) => t(`applicationsPage.aiStatus.${status}`),
    [t]
  );

  const loadRanked = useCallback(async () => {
    if (!jobId.trim()) {
      setError(t('applicationsPage.errors.jobIdRequired'));
      return;
    }

    setIsLoadingRanked(true);
    setError(null);

    try {
      const result = await fetchRankedApplications({
        jobId: jobId.trim(),
        limit: 20,
        page: rankedPage,
        status: rankedStatusFilter,
      });
      setRankedItems(result.data.candidates);
      setRankedTotalPages(result.data.pagination.total_pages);

      const summaryResult = await fetchApplicationStatusSummary(jobId.trim());
      setSummary(summaryResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('applicationsPage.errors.loadRankingFailed'));
    } finally {
      setIsLoadingRanked(false);
    }
  }, [jobId, rankedPage, rankedStatusFilter, t]);

  const loadHistory = useCallback(async () => {
    if (!candidateId.trim()) {
      setError(t('applicationsPage.errors.candidateIdRequired'));
      return;
    }

    setIsLoadingHistory(true);
    setError(null);

    try {
      const result = await fetchCandidateApplicationHistory({
        candidateId: candidateId.trim(),
        limit: 20,
        page: historyPage,
        status: historyStatusFilter,
      });
      setHistoryItems(result.data.applications);
      setHistoryTotalPages(result.data.pagination.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('applicationsPage.errors.loadHistoryFailed'));
    } finally {
      setIsLoadingHistory(false);
    }
  }, [candidateId, historyPage, historyStatusFilter, t]);

  function activateRanked() {
    setRankedPage(1);
    setStatusChangesPage(1);
    setRankedActivated(true);
    setStatusChangesActivated(true);
  }

  function activateHistory() {
    setHistoryPage(1);
    setHistoryActivated(true);
  }

  function renderSummary() {
    if (!summary) return null;

    return (
      <Card variant="outline" className="space-y-3">
        <CardTitle className="text-2xl">{t('applicationsPage.summary.title')}</CardTitle>
        <CardDescription className="text-xs uppercase">
          {t('applicationsPage.summary.totalApplications', { count: summary.total })}
        </CardDescription>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {STATUS_OPTIONS.map((status) => (
            <div key={status} className="border border-black bg-white p-2">
              <p className="font-mono text-[10px] uppercase text-gray-500">{statusLabel(status)}</p>
              <p className="text-lg font-bold">{summary.by_status[status] || 0}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {AI_STATUS_OPTIONS.map((status) => (
            <div key={status} className="border border-black bg-blue-50 p-2">
              <p className="font-mono text-[10px] uppercase text-blue-700">
                {t('applicationsPage.summary.aiStatusLabel', { status: aiStatusLabel(status) })}
              </p>
              <p className="text-lg font-bold text-blue-900">{summary.by_ai_status[status] || 0}</p>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  async function handleStatusChange(applicationId: string, status: ApplicationStatus) {
    setError(null);

    try {
      await updateApplicationStatus(applicationId, status, 'recruiter-ui');
      setRankedItems((prev) =>
        prev.map((item) => (item.application_id === applicationId ? { ...item, status } : item))
      );
      setHistoryItems((prev) =>
        prev.map((item) => (item.application_id === applicationId ? { ...item, status } : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('applicationsPage.errors.updateStatusFailed'));
    }
  }

  async function openFeedback(applicationId: string) {
    setError(null);

    try {
      const result = await fetchApplicationFeedback(applicationId);
      setFeedback(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('applicationsPage.errors.loadFeedbackFailed'));
    }
  }

  const loadRecentStatusChanges = useCallback(async () => {
    if (!jobId.trim()) {
      setError(t('applicationsPage.errors.jobIdRequired'));
      return;
    }

    setError(null);
    setIsLoadingStatusChanges(true);
    try {
      const result = await fetchRecentStatusChanges({
        jobId: jobId.trim(),
        page: statusChangesPage,
        limit: 20,
        status: statusChangesFilter,
        changedBy: statusChangesChangedBy,
        changedAfter: statusChangesChangedAfter,
        changedBefore: statusChangesChangedBefore,
      });
      setStatusChanges(result.data.changes);
      setStatusChangesTotalPages(result.data.pagination.total_pages);
      setStatusChangesTotal(result.data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('applicationsPage.errors.loadStatusChangesFailed'));
    } finally {
      setIsLoadingStatusChanges(false);
    }
  }, [
    jobId,
    statusChangesPage,
    statusChangesFilter,
    statusChangesChangedBy,
    statusChangesChangedAfter,
    statusChangesChangedBefore,
    t,
  ]);

  async function openStatusHistory(applicationId: string, candidateName: string) {
    setError(null);

    try {
      const result = await fetchApplicationStatusHistory(applicationId);
      setSelectedStatusHistory({
        applicationId,
        candidateName,
        currentStatus: result.data.current_status,
        entries: result.data.history,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('applicationsPage.errors.loadStatusHistoryFailed'));
    }
  }

  function openOriginalResume(resumeId: string | null) {
    setError(null);
    if (!resumeId) {
      setError(t('applicationsPage.errors.resumeIdRequired'));
      return;
    }

    const url = getOriginalResumeDownloadUrl(resumeId);
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (!popup) {
      setError(t('common.popupBlocked', { url }));
    }
  }

  useEffect(() => {
    if (!rankedActivated) return;
    if (!jobId.trim()) return;
    void loadRanked();
  }, [rankedActivated, jobId, rankedPage, rankedStatusFilter, loadRanked]);

  useEffect(() => {
    if (!historyActivated) return;
    if (!candidateId.trim()) return;
    void loadHistory();
  }, [historyActivated, candidateId, historyPage, historyStatusFilter, loadHistory]);

  useEffect(() => {
    if (!statusChangesActivated) return;
    if (!jobId.trim()) return;
    void loadRecentStatusChanges();
  }, [
    statusChangesActivated,
    jobId,
    statusChangesPage,
    statusChangesFilter,
    statusChangesChangedBy,
    statusChangesChangedAfter,
    statusChangesChangedBefore,
    loadRecentStatusChanges,
  ]);

  return (
    <div className="min-h-screen bg-[#F0F0E8] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black pb-4">
          <div>
            <h1 className="font-serif text-4xl uppercase tracking-tight">{t('applicationsPage.title')}</h1>
            <p className="font-mono text-xs uppercase text-blue-700">{t('applicationsPage.subtitle')}</p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline">{t('nav.backToDashboard')}</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card variant="outline" className="space-y-3">
            <CardTitle className="text-xl">{t('applicationsPage.recruiterView.title')}</CardTitle>
            <CardDescription className="text-xs uppercase">
              {t('applicationsPage.recruiterView.description')}
            </CardDescription>
            <div className="flex gap-2">
              <Input
                placeholder={t('applicationsPage.recruiterView.jobIdPlaceholder')}
                value={jobId}
                onChange={(e) => {
                  setJobId(e.target.value);
                  setRankedPage(1);
                  setStatusChangesPage(1);
                }}
              />
              <select
                className="h-10 border border-black bg-transparent px-2 text-xs uppercase rounded-none"
                value={rankedStatusFilter}
                onChange={(e) => {
                  setRankedStatusFilter(e.target.value as ApplicationStatus | '');
                  setRankedPage(1);
                }}
              >
                <option value="">{t('applicationsPage.allStatus')}</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
              <Button onClick={activateRanked} disabled={isLoadingRanked}>
                {isLoadingRanked ? t('common.loading') : t('applicationsPage.load')}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={rankedPage <= 1 || isLoadingRanked}
                onClick={() => setRankedPage((value) => Math.max(1, value - 1))}
              >
                {t('applicationsPage.prev')}
              </Button>
              <span className="font-mono text-xs uppercase">
                {t('applicationsPage.pageLabel', { page: rankedPage, totalPages: rankedTotalPages })}
              </span>
              <Button
                variant="outline"
                disabled={rankedPage >= rankedTotalPages || isLoadingRanked}
                onClick={() => setRankedPage((value) => value + 1)}
              >
                {t('applicationsPage.next')}
              </Button>
            </div>
            <p className="font-mono text-xs uppercase text-gray-600">
              {t('applicationsPage.recruiterView.countCandidates', { count: rankedItems.length })}{' '}
              {topHybrid !== null
                ? t('applicationsPage.recruiterView.topHybrid', { score: topHybrid.toFixed(2) })
                : ''}
            </p>
          </Card>

          <Card variant="outline" className="space-y-3">
            <CardTitle className="text-xl">{t('applicationsPage.candidateView.title')}</CardTitle>
            <CardDescription className="text-xs uppercase">
              {t('applicationsPage.candidateView.description')}
            </CardDescription>
            <div className="flex gap-2">
              <Input
                placeholder={t('applicationsPage.candidateView.candidateIdPlaceholder')}
                value={candidateId}
                onChange={(e) => {
                  setCandidateId(e.target.value);
                  setHistoryPage(1);
                }}
              />
              <select
                className="h-10 border border-black bg-transparent px-2 text-xs uppercase rounded-none"
                value={historyStatusFilter}
                onChange={(e) => {
                  setHistoryStatusFilter(e.target.value as ApplicationStatus | '');
                  setHistoryPage(1);
                }}
              >
                <option value="">{t('applicationsPage.allStatus')}</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
              <Button onClick={activateHistory} disabled={isLoadingHistory}>
                {isLoadingHistory ? t('common.loading') : t('applicationsPage.load')}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={historyPage <= 1 || isLoadingHistory}
                onClick={() => setHistoryPage((value) => Math.max(1, value - 1))}
              >
                {t('applicationsPage.prev')}
              </Button>
              <span className="font-mono text-xs uppercase">
                {t('applicationsPage.pageLabel', { page: historyPage, totalPages: historyTotalPages })}
              </span>
              <Button
                variant="outline"
                disabled={historyPage >= historyTotalPages || isLoadingHistory}
                onClick={() => setHistoryPage((value) => value + 1)}
              >
                {t('applicationsPage.next')}
              </Button>
            </div>
            <p className="font-mono text-xs uppercase text-gray-600">
              {t('applicationsPage.candidateView.countApplications', { count: historyItems.length })}
            </p>
          </Card>
        </div>

        {renderSummary()}

        <Card variant="outline" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-2xl">{t('applicationsPage.statusChanges.title')}</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStatusChangesFilter('');
                  setStatusChangesChangedBy('');
                  setStatusChangesChangedAfter('');
                  setStatusChangesChangedBefore('');
                  setStatusChangesPreset('');
                  setStatusChangesPage(1);
                  setStatusChangesActivated(true);
                }}
                disabled={isLoadingStatusChanges}
              >
                {t('applicationsPage.statusChanges.clearFiltersButton')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStatusChangesPage(1);
                  setStatusChangesActivated(true);
                }}
                disabled={isLoadingStatusChanges}
              >
                {isLoadingStatusChanges
                  ? t('common.loading')
                  : t('applicationsPage.statusChanges.refreshButton')}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="h-10 border border-black bg-transparent px-2 text-xs uppercase rounded-none"
              value={statusChangesFilter}
              onChange={(e) => {
                setStatusChangesFilter(e.target.value as ApplicationStatus | '');
                setStatusChangesPage(1);
              }}
            >
              <option value="">{t('applicationsPage.allStatus')}</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
            <Input
              placeholder={t('applicationsPage.statusChanges.changedByPlaceholder')}
              value={statusChangesChangedBy}
              onChange={(e) => {
                setStatusChangesChangedBy(e.target.value);
                setStatusChangesPage(1);
              }}
            />
            <div className="flex items-center gap-2 border border-black bg-white px-2 h-10">
              <span className="font-mono text-[10px] uppercase text-gray-600">
                {t('applicationsPage.statusChanges.changedAfterLabel')}
              </span>
              <Input
                type="date"
                aria-label={t('applicationsPage.statusChanges.changedAfterLabel')}
                value={statusChangesChangedAfter}
                onChange={(e) => {
                  setStatusChangesPreset('');
                  setStatusChangesChangedAfter(e.target.value);
                  setStatusChangesPage(1);
                }}
                className="h-8 border-0 p-0 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 border border-black bg-white px-2 h-10">
              <span className="font-mono text-[10px] uppercase text-gray-600">
                {t('applicationsPage.statusChanges.changedBeforeLabel')}
              </span>
              <Input
                type="date"
                aria-label={t('applicationsPage.statusChanges.changedBeforeLabel')}
                value={statusChangesChangedBefore}
                onChange={(e) => {
                  setStatusChangesPreset('');
                  setStatusChangesChangedBefore(e.target.value);
                  setStatusChangesPage(1);
                }}
                className="h-8 border-0 p-0 text-xs"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase text-gray-600">
              {t('applicationsPage.statusChanges.quickRangeLabel')}
            </span>
            {(['7d', '30d', '90d'] as const).map((preset) => (
              <Button
                key={preset}
                variant="outline"
                className={statusChangesPreset === preset ? 'bg-blue-50 border-blue-700 text-blue-700' : ''}
                onClick={() => applyStatusChangesPreset(preset)}
                disabled={isLoadingStatusChanges}
              >
                {t(`applicationsPage.statusChanges.preset.${preset}`)}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={statusChangesPage <= 1 || isLoadingStatusChanges}
              onClick={() => setStatusChangesPage((value) => Math.max(1, value - 1))}
            >
              {t('applicationsPage.prev')}
            </Button>
            <span className="font-mono text-xs uppercase">
              {t('applicationsPage.pageLabel', {
                page: statusChangesPage,
                totalPages: statusChangesTotalPages,
              })}
            </span>
            <Button
              variant="outline"
              disabled={statusChangesPage >= statusChangesTotalPages || isLoadingStatusChanges}
              onClick={() => setStatusChangesPage((value) => value + 1)}
            >
              {t('applicationsPage.next')}
            </Button>
            <span className="font-mono text-xs uppercase text-gray-600">
              {t('applicationsPage.statusChanges.countChanges', { count: statusChangesTotal })}
            </span>
          </div>
          <div className="space-y-2">
            {statusChanges.length ? (
              statusChanges.map((item) => (
                <div key={`${item.application_id}-${item.changed_at}`} className="border border-black bg-white p-3">
                  <p className="font-bold">{item.candidate.full_name}</p>
                  <p className="font-mono text-[11px] uppercase text-gray-600">
                    {item.candidate.email || t('applicationsPage.rankedCandidates.notAvailable')}
                  </p>
                  <p className="font-mono text-[11px] uppercase text-blue-700 mt-1">
                    {t('applicationsPage.statusChanges.transitionLine', {
                      from: statusLabel(item.from_status || item.to_status),
                      to: statusLabel(item.to_status),
                    })}
                  </p>
                  <p className="font-mono text-[11px] uppercase text-gray-600">
                    {t('applicationsPage.statusChanges.changedByLine', {
                      by: item.changed_by || t('common.unknown'),
                    })}
                  </p>
                  <p className="font-mono text-[11px] uppercase text-gray-600">
                    {t('applicationsPage.statusChanges.changedAtLine', {
                      date: new Date(item.changed_at).toLocaleString(),
                    })}
                  </p>
                </div>
              ))
            ) : (
              <p className="font-mono text-xs uppercase text-gray-500">
                {t('applicationsPage.statusChanges.empty')}
              </p>
            )}
          </div>
        </Card>

        {error ? (
          <Card variant="outline" className="border-red-700 bg-red-50">
            <CardTitle className="text-red-700">{t('common.error')}</CardTitle>
            <CardDescription className="text-red-700">{error}</CardDescription>
          </Card>
        ) : null}

        <Card variant="outline" className="space-y-4">
          <CardTitle className="text-2xl">{t('applicationsPage.rankedCandidates.title')}</CardTitle>
          <div className="space-y-2">
            {rankedItems.map((item) => (
              <div
                key={item.application_id}
                className="border border-black bg-white p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-bold">{item.candidate.full_name}</p>
                  <p className="text-xs uppercase text-gray-600">
                    {item.candidate.email || t('applicationsPage.rankedCandidates.notAvailable')}
                  </p>
                  <p className="font-mono text-[11px] uppercase text-gray-500 mt-1">
                    {item.resume.title || t('applicationsPage.rankedCandidates.notAvailable')}
                  </p>
                  <p className="font-mono text-xs mt-1 uppercase text-blue-700">
                    {t('applicationsPage.rankedCandidates.scoreLine', {
                      hybrid: item.scores.hybrid_score.toFixed(2),
                      semantic: item.scores.semantic_score.toFixed(2),
                      keyword: item.scores.keyword_score.toFixed(2),
                    })}
                  </p>
                  {item.status_audit ? (
                    <p className="font-mono text-[11px] uppercase text-gray-500 mt-1">
                      {t('applicationsPage.rankedCandidates.statusAuditLine', {
                        from: statusLabel(item.status_audit.from_status || item.status),
                        to: statusLabel(item.status_audit.to_status),
                        by: item.status_audit.changed_by || t('common.unknown'),
                        date: new Date(item.status_audit.changed_at).toLocaleString(),
                      })}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className={`h-10 border px-2 text-xs uppercase rounded-none ${badgeClass(item.status)}`}
                    value={item.status}
                    onChange={(e) =>
                      handleStatusChange(item.application_id, e.target.value as ApplicationStatus)
                    }
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                  <Button variant="outline" onClick={() => openFeedback(item.application_id)}>
                    {t('applicationsPage.rankedCandidates.feedbackButton')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openStatusHistory(item.application_id, item.candidate.full_name)}
                  >
                    {t('applicationsPage.rankedCandidates.statusHistoryButton')}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!item.resume.id}
                    onClick={() => openOriginalResume(item.resume.id)}
                  >
                    {t('applicationsPage.rankedCandidates.downloadOriginalResumeButton')}
                  </Button>
                </div>
              </div>
            ))}

            {!rankedItems.length ? (
              <p className="font-mono text-xs uppercase text-gray-500">
                {t('applicationsPage.rankedCandidates.empty')}
              </p>
            ) : null}
          </div>
        </Card>

        <Card variant="outline" className="space-y-4">
          <CardTitle className="text-2xl">{t('applicationsPage.candidateHistory.title')}</CardTitle>
          <div className="space-y-2">
            {historyItems.map((item) => (
              <div key={item.application_id} className="border border-black bg-white p-3">
                <p className="font-bold">{item.job.title}</p>
                <p className="text-xs uppercase text-gray-600">
                  {item.job.location || t('applicationsPage.candidateHistory.notAvailable')} |{' '}
                  {item.job.category || t('applicationsPage.candidateHistory.notAvailable')} |{' '}
                  {statusLabel(item.status)}
                </p>
                <p className="font-mono text-xs uppercase text-blue-700 mt-1">
                  {t('applicationsPage.candidateHistory.hybridLine', {
                    score: item.scores.hybrid_score.toFixed(2),
                  })}
                </p>
              </div>
            ))}

            {!historyItems.length ? (
              <p className="font-mono text-xs uppercase text-gray-500">
                {t('applicationsPage.candidateHistory.empty')}
              </p>
            ) : null}
          </div>
        </Card>

        {feedback ? (
          <Card variant="outline" className="space-y-3">
            <CardTitle className="text-2xl">{t('applicationsPage.feedback.title')}</CardTitle>
            <CardDescription className="text-xs uppercase">
              {t('applicationsPage.feedback.statusLine', {
                status: statusLabel(feedback.status),
                aiStatus: aiStatusLabel(feedback.ai_status),
              })}
            </CardDescription>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="border border-black bg-white p-3">
                <p className="font-mono text-xs uppercase text-gray-500">{t('applicationsPage.feedback.hybrid')}</p>
                <p className="text-2xl font-bold">{feedback.scores.hybrid_score.toFixed(2)}</p>
              </div>
              <div className="border border-black bg-white p-3">
                <p className="font-mono text-xs uppercase text-gray-500">
                  {t('applicationsPage.feedback.matchedKeywords')}
                </p>
                <p className="text-sm">
                  {feedback.explainability.matched_keywords.join(', ') || t('applicationsPage.feedback.none')}
                </p>
              </div>
              <div className="border border-black bg-white p-3">
                <p className="font-mono text-xs uppercase text-gray-500">
                  {t('applicationsPage.feedback.missingKeywords')}
                </p>
                <p className="text-sm">
                  {feedback.explainability.missing_keywords.join(', ') || t('applicationsPage.feedback.none')}
                </p>
              </div>
            </div>
            <div className="border border-black bg-blue-50 p-3">
              <p className="font-mono text-xs uppercase text-blue-700 mb-2">
                {t('applicationsPage.feedback.recommendations')}
              </p>
              <ul className="list-disc pl-6 text-sm space-y-1">
                {feedback.recommendations.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          </Card>
        ) : null}

        {selectedStatusHistory ? (
          <Card variant="outline" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-2xl">
                {t('applicationsPage.statusHistory.title', {
                  name: selectedStatusHistory.candidateName,
                })}
              </CardTitle>
              <Button variant="outline" onClick={() => setSelectedStatusHistory(null)}>
                {t('common.close')}
              </Button>
            </div>
            <CardDescription className="text-xs uppercase">
              {t('applicationsPage.statusHistory.currentStatus', {
                status: statusLabel(selectedStatusHistory.currentStatus),
              })}
            </CardDescription>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {selectedStatusHistory.entries.length ? (
                selectedStatusHistory.entries.map((entry, index) => (
                  <div key={`${entry.changed_at}-${index}`} className="border border-black bg-white p-3">
                    <p className="font-mono text-[11px] uppercase text-blue-700">
                      {statusLabel(entry.from_status || 'new')} {'->'} {statusLabel(entry.to_status)}
                    </p>
                    <p className="font-mono text-[11px] uppercase text-gray-600 mt-1">
                      {t('applicationsPage.statusHistory.changedAt')}: {new Date(entry.changed_at).toLocaleString()}
                    </p>
                    <p className="font-mono text-[11px] uppercase text-gray-600">
                      {t('applicationsPage.statusHistory.changedBy')}: {entry.changed_by || t('common.unknown')}
                    </p>
                  </div>
                ))
              ) : (
                <p className="font-mono text-xs uppercase text-gray-500">
                  {t('applicationsPage.statusHistory.empty')}
                </p>
              )}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
