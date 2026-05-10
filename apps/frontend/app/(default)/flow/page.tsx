'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { ResumeUploadDialog } from '@/components/dashboard/resume-upload-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createApplication } from '@/lib/api/applications';
import type { ApiClientError } from '@/lib/api/error';
import { useAuth } from '@/lib/context/auth-context';
import {
  confirmImproveResume,
  getResumePdfUrl,
  previewImproveResume,
  uploadJobDescriptions,
} from '@/lib/api/resume';
import { useTranslations } from '@/lib/i18n';
import { downloadBlobAsFile } from '@/lib/utils/download';
import { logError } from '@/lib/utils/logger';
import {
  applyFlowReturnPrecedence,
  applyJobsFilterPrecedence,
  buildPathWithQuery,
  createSearchParams,
  sanitizeApplicationsReturnSnapshot,
  sanitizeJobsReturnSnapshot,
  setOrDeleteQueryParam,
} from '@/lib/utils/query-params';

const APPLY_SESSION_HISTORY_STORAGE_KEY = 'flow_apply_session_history_v1';
const FLOW_PREFILL_JOB_STORAGE_KEY = 'flow_prefill_job_v1';

type ApplySessionHistoryItem = {
  applicationId: string | null;
  jobId: string;
  resumeId: string;
  outcome: 'created' | 'duplicate';
  createdAt: string;
};

type FlowPrefillJobPayload = {
  jobId: string;
  jobDescription: string;
  source: 'jobs';
  createdAt: string;
};

type ApplySessionHistoryFilter = 'all' | 'created' | 'duplicate';

function isValidApplySessionHistoryItem(value: unknown): value is ApplySessionHistoryItem {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as ApplySessionHistoryItem;
  return (
    (candidate.applicationId === null || typeof candidate.applicationId === 'string') &&
    typeof candidate.jobId === 'string' &&
    typeof candidate.resumeId === 'string' &&
    (candidate.outcome === 'created' || candidate.outcome === 'duplicate') &&
    typeof candidate.createdAt === 'string'
  );
}

function isValidFlowPrefillJobPayload(value: unknown): value is FlowPrefillJobPayload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as FlowPrefillJobPayload;
  return (
    typeof candidate.jobId === 'string' &&
    typeof candidate.jobDescription === 'string' &&
    candidate.source === 'jobs' &&
    typeof candidate.createdAt === 'string'
  );
}

export default function ProductFlowPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslations();
  const { user } = useAuth();
  const isCandidateOnly = user?.role === 'candidate';
  const flowCandidateId = isCandidateOnly ? (user?.id || '').trim() : '';
  const flowReturnJobId = (searchParams.get('flow_return_job_id') || '').trim();
  const flowReturnApplicationId = (searchParams.get('flow_return_application_id') || '').trim();
  const flowReturnQuery = (searchParams.get('flow_return_query') || '').trim();
  const jobsReturnQuery = (searchParams.get('jobs_return_query') || '').trim();
  const openedFromFocusedJob = searchParams.get('focused_job') === '1';
  const shouldHydratePrefillJob = searchParams.get('prefill_job') === '1';

  const parseFlowReturnPanel = (
    value: string | null
  ): 'status-history' | 'status-changes' | 'feedback' | null => {
    if (value === 'status-history' || value === 'status-changes' || value === 'feedback') {
      return value;
    }
    return null;
  };

  const parsePanelFromOpenFlags = (
    params: URLSearchParams
  ): 'status-history' | 'status-changes' | 'feedback' | null => {
    if (params.get('sh_open') === '1') return 'status-history';
    if (params.get('sc_open') === '1') return 'status-changes';
    if (params.get('fb_open') === '1') return 'feedback';
    return null;
  };

  const [masterResumeId, setMasterResumeId] = useState<string | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [prefilledJobId, setPrefilledJobId] = useState<string | null>(null);
  const [prefilledJobDescription, setPrefilledJobDescription] = useState('');
  const [tailoredResumeId, setTailoredResumeId] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [applySessionHistory, setApplySessionHistory] = useState<ApplySessionHistoryItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<ApplySessionHistoryFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const flowReturnTargetRef = useRef<HTMLLIElement | null>(null);

  const [previewResult, setPreviewResult] = useState<Awaited<
    ReturnType<typeof previewImproveResume>
  > | null>(null);

  useEffect(() => {
    const storedId = localStorage.getItem('master_resume_id');
    if (storedId) {
      setMasterResumeId(storedId);
    }

    const rawHistory = localStorage.getItem(APPLY_SESSION_HISTORY_STORAGE_KEY);
    if (!rawHistory) return;

    try {
      const parsed = JSON.parse(rawHistory);
      if (!Array.isArray(parsed)) return;
      const normalized = parsed.filter(isValidApplySessionHistoryItem).slice(0, 20);
      setApplySessionHistory(normalized);
    } catch {
      localStorage.removeItem(APPLY_SESSION_HISTORY_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!shouldHydratePrefillJob) return;

    const rawPrefill = localStorage.getItem(FLOW_PREFILL_JOB_STORAGE_KEY);
    if (!rawPrefill) return;

    try {
      const parsed = JSON.parse(rawPrefill);
      if (!isValidFlowPrefillJobPayload(parsed)) {
        localStorage.removeItem(FLOW_PREFILL_JOB_STORAGE_KEY);
        return;
      }

      const normalizedDescription = parsed.jobDescription.trim();
      if (!normalizedDescription) {
        localStorage.removeItem(FLOW_PREFILL_JOB_STORAGE_KEY);
        return;
      }

      setJobDescription(normalizedDescription);
      setJobId(parsed.jobId);
      setPrefilledJobId(parsed.jobId);
      setPrefilledJobDescription(normalizedDescription);
      setPreviewResult(null);
      setTailoredResumeId(null);
      setApplicationId(null);
      setError(null);
      setMessage(t('flow.messages.prefilledFromJobs'));
    } catch {
      localStorage.removeItem(FLOW_PREFILL_JOB_STORAGE_KEY);
      return;
    }

    localStorage.removeItem(FLOW_PREFILL_JOB_STORAGE_KEY);
  }, [shouldHydratePrefillJob, t]);

  useEffect(() => {
    localStorage.setItem(APPLY_SESSION_HISTORY_STORAGE_KEY, JSON.stringify(applySessionHistory));
  }, [applySessionHistory]);

  const formatRelativeSessionTime = (createdAt: string) => {
    const createdAtMs = new Date(createdAt).getTime();
    if (!Number.isFinite(createdAtMs)) {
      return t('flow.sessionHistory.justNow');
    }

    const diffSeconds = Math.max(0, Math.floor((Date.now() - createdAtMs) / 1000));
    if (diffSeconds < 60) {
      return t('flow.sessionHistory.justNow');
    }

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return t('flow.sessionHistory.minutesAgo', { count: diffMinutes });
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return t('flow.sessionHistory.hoursAgo', { count: diffHours });
    }

    return t('flow.sessionHistory.daysAgo', { count: Math.floor(diffHours / 24) });
  };

  const stepState = useMemo(() => {
    return {
      hasMasterResume: Boolean(masterResumeId),
      hasJobDescription: jobDescription.trim().length >= 50,
      hasPreview: Boolean(previewResult),
      hasConfirmedTailoredResume: Boolean(tailoredResumeId),
      hasApplication: Boolean(applicationId),
      canStartNextJob: Boolean(
        jobDescription.trim() || jobId || previewResult || tailoredResumeId || applicationId
      ),
    };
  }, [applicationId, jobDescription, jobId, masterResumeId, previewResult, tailoredResumeId]);

  const filteredSessionHistory = useMemo(() => {
    if (historyFilter === 'all') return applySessionHistory;
    return applySessionHistory.filter((item) => item.outcome === historyFilter);
  }, [applySessionHistory, historyFilter]);

  const isFlowReturnTarget = (item: ApplySessionHistoryItem) => {
    if (flowReturnApplicationId) {
      return item.applicationId === flowReturnApplicationId;
    }
    if (flowReturnJobId) {
      return item.jobId === flowReturnJobId;
    }
    return false;
  };

  const jobsReturnHref = useMemo(() => {
    if (!jobsReturnQuery) {
      const params = createSearchParams();
      params.set('status', 'all');
      params.set('source', 'flow');
      const resolvedJobId = (jobId || '').trim();
      if (resolvedJobId) {
        params.set('focus_job_id', resolvedJobId);
      }
      return buildPathWithQuery('/jobs', params);
    }

    const params = sanitizeJobsReturnSnapshot(jobsReturnQuery, {
      stripApplicationsReturn: false,
    });
    applyJobsFilterPrecedence(params, searchParams);
    const resolvedJobId = (jobId || '').trim();
    if (resolvedJobId && !(params.get('focus_job_id') || '').trim()) {
      params.set('focus_job_id', resolvedJobId);
    }
    if (!(params.get('status') || '').trim()) {
      params.set('status', 'all');
    }
    const source = (params.get('source') || '').trim();
    if (!source || (source !== 'applications' && source !== 'flow')) {
      params.set('source', 'flow');
    }

    return buildPathWithQuery('/jobs', params);
  }, [jobsReturnQuery, searchParams, jobId]);

  const applicationsReturnQueryFromJobs = useMemo(() => {
    if (!jobsReturnQuery) return '';
    const params = createSearchParams(jobsReturnQuery);
    return sanitizeApplicationsReturnSnapshot(params.get('applications_return_query')).toString();
  }, [jobsReturnQuery]);

  const buildJobBoardHref = (nextJobId: string) => {
    const params = sanitizeJobsReturnSnapshot(jobsReturnQuery, {
      stripApplicationsReturn: false,
    });
    applyJobsFilterPrecedence(params, searchParams);
    const resolvedJobId = nextJobId.trim();
    if (resolvedJobId) {
      params.set('focus_job_id', resolvedJobId);
    }
    if (!(params.get('status') || '').trim()) {
      params.set('status', 'all');
    }
    const source = (params.get('source') || '').trim();
    if (!source || (source !== 'applications' && source !== 'flow')) {
      params.set('source', 'flow');
    }
    return buildPathWithQuery('/jobs', params);
  };

  const prioritizedSessionHistory = useMemo(() => {
    if (!flowReturnJobId && !flowReturnApplicationId) {
      return filteredSessionHistory;
    }

    const targetIndex = filteredSessionHistory.findIndex((item) => isFlowReturnTarget(item));
    if (targetIndex <= 0) {
      return filteredSessionHistory;
    }

    return [
      filteredSessionHistory[targetIndex],
      ...filteredSessionHistory.slice(0, targetIndex),
      ...filteredSessionHistory.slice(targetIndex + 1),
    ];
  }, [filteredSessionHistory, flowReturnJobId, flowReturnApplicationId]);

  useEffect(() => {
    if (!flowReturnJobId && !flowReturnApplicationId) return;
    if (historyFilter !== 'all') {
      setHistoryFilter('all');
    }
  }, [flowReturnJobId, flowReturnApplicationId, historyFilter]);

  useEffect(() => {
    if (!flowReturnJobId && !flowReturnApplicationId) return;

    const timeoutId = window.setTimeout(() => {
      flowReturnTargetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [flowReturnJobId, flowReturnApplicationId, prioritizedSessionHistory]);

  const buildApplicationsHref = ({
    nextJobId,
    nextApplicationId,
    nextCandidateId,
    openPanel,
  }: {
    nextJobId: string;
    nextApplicationId: string;
    nextCandidateId?: string;
    openPanel?: 'status-history' | 'status-changes' | 'feedback';
  }) => {
    const baseReturnQuery = flowReturnQuery || applicationsReturnQueryFromJobs;
    const params = sanitizeApplicationsReturnSnapshot(baseReturnQuery);
    if (flowReturnQuery) {
      applyFlowReturnPrecedence(params, searchParams);
    }
    const snapshotPanel =
      parseFlowReturnPanel(params.get('flow_panel')) || parsePanelFromOpenFlags(params);
    params.delete('flow_panel');

    const resolvedCandidateId = (nextCandidateId || '').trim();
    const resolvedJobId = nextJobId.trim();
    const resolvedApplicationId = nextApplicationId.trim();

    const jobsReturnParams = sanitizeJobsReturnSnapshot(jobsReturnQuery);
    if (!resolvedCandidateId) {
      if (resolvedJobId && !(jobsReturnParams.get('focus_job_id') || '').trim()) {
        jobsReturnParams.set('focus_job_id', resolvedJobId);
      }
      if (!(jobsReturnParams.get('status') || '').trim()) {
        jobsReturnParams.set('status', 'all');
      }
      const jobsSource = (jobsReturnParams.get('source') || '').trim();
      if (!jobsSource || (jobsSource !== 'applications' && jobsSource !== 'flow')) {
        jobsReturnParams.set('source', 'flow');
      }
    }

    const jobsReturnSnapshot = jobsReturnParams.toString();
    if (jobsReturnSnapshot) {
      params.set('jobs_return_query', jobsReturnSnapshot);
    }

    if (resolvedCandidateId) {
      setOrDeleteQueryParam(params, 'candidate_id', resolvedCandidateId);
      setOrDeleteQueryParam(params, 'application_id', resolvedApplicationId);
      setOrDeleteQueryParam(params, 'candidate_focus', resolvedApplicationId ? '1' : '');
      params.delete('job_id');
    } else {
      setOrDeleteQueryParam(params, 'job_id', resolvedJobId);
      setOrDeleteQueryParam(params, 'application_id', resolvedApplicationId);
      params.delete('candidate_id');
      params.delete('candidate_focus');
    }

    params.delete('sh_open');
    params.delete('sc_open');
    params.delete('fb_open');

    const resolvedPanel = openPanel || snapshotPanel;
    const canOpenPanel = Boolean(resolvedApplicationId);

    if (resolvedPanel === 'status-history' && canOpenPanel) {
      params.set('sh_open', '1');
    }
    if (resolvedPanel === 'status-changes' && canOpenPanel) {
      params.set('sc_open', '1');
    }
    if (resolvedPanel === 'feedback' && canOpenPanel) {
      params.set('fb_open', '1');
    }

    params.set('flow_ctx', '1');
    return buildPathWithQuery('/applications', params);
  };

  const handleUploadComplete = (resumeId: string) => {
    localStorage.setItem('master_resume_id', resumeId);
    setMasterResumeId(resumeId);
    setJobId(null);
    setPreviewResult(null);
    setTailoredResumeId(null);
    setApplicationId(null);
    setError(null);
    setMessage(t('flow.messages.masterUploaded'));
  };

  const handleJobDescriptionChange = (nextValue: string) => {
    setJobDescription(nextValue);
    if (prefilledJobId) {
      setPrefilledJobId(null);
      setPrefilledJobDescription('');
    }

    if (previewResult || tailoredResumeId || jobId) {
      setPreviewResult(null);
      setTailoredResumeId(null);
      setApplicationId(null);
      setJobId(null);
      setError(null);
      setMessage(t('flow.messages.previewResetByInputChange'));
    }
  };

  const handleGeneratePreview = async () => {
    if (!masterResumeId) {
      setError(t('flow.errors.masterRequired'));
      return;
    }

    const trimmedDescription = jobDescription.trim();
    const canReusePrefilledJob =
      Boolean(prefilledJobId) &&
      Boolean(jobId) &&
      trimmedDescription === prefilledJobDescription &&
      jobId === prefilledJobId;

    if (!canReusePrefilledJob && trimmedDescription.length < 50) {
      setError(t('flow.errors.jobDescriptionTooShort'));
      return;
    }

    setIsGenerating(true);
    setError(null);
    setMessage(null);

    try {
      let resolvedJobId = jobId;
      if (!canReusePrefilledJob) {
        resolvedJobId = await uploadJobDescriptions([trimmedDescription], masterResumeId);
      }

      if (!resolvedJobId) {
        throw new Error('Job id missing for preview generation');
      }

      setJobId(resolvedJobId);

      const preview = await previewImproveResume(masterResumeId, resolvedJobId);
      setPreviewResult(preview);
      setTailoredResumeId(null);
      setApplicationId(null);
      setMessage(t('flow.messages.previewGenerated'));
    } catch (err) {
      logError('product-flow-page', 'Failed to generate preview', err);
      setError(t('flow.errors.previewFailed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirm = async () => {
    if (!masterResumeId || !previewResult?.data?.job_id || !previewResult?.data?.resume_preview) {
      setError(t('flow.errors.missingPreviewData'));
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      const confirmed = await confirmImproveResume({
        resume_id: masterResumeId,
        job_id: previewResult.data.job_id,
        improved_data: previewResult.data.resume_preview,
        improvements:
          previewResult.data.improvements?.map((item) => ({
            suggestion: item.suggestion,
            lineNumber: typeof item.lineNumber === 'number' ? item.lineNumber : null,
          })) || [],
      });

      const newResumeId = confirmed?.data?.resume_id;
      if (!newResumeId) {
        throw new Error('Tailored resume id missing in confirm response');
      }

      setTailoredResumeId(newResumeId);
      setApplicationId(null);
      setMessage(t('flow.messages.tailoredCreated'));
    } catch (err) {
      logError('product-flow-page', 'Failed to confirm tailored resume', err);
      setError(t('flow.errors.confirmFailed'));
    } finally {
      setIsConfirming(false);
    }
  };

  const openPdfPreview = () => {
    if (!tailoredResumeId) return;
    const url = getResumePdfUrl(tailoredResumeId);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleApplyNow = async () => {
    if (!tailoredResumeId || !jobId) {
      setError(t('flow.errors.applicationMissingData'));
      return;
    }

    setIsApplying(true);
    setError(null);

    try {
      const created = await createApplication({
        job_id: jobId,
        resume_id: tailoredResumeId,
      });

      const createdApplicationId = created?.data?.application_id || null;

      setApplicationId(createdApplicationId);
      const createdEvent: ApplySessionHistoryItem = {
        applicationId: createdApplicationId,
        jobId,
        resumeId: tailoredResumeId,
        outcome: 'created',
        createdAt: new Date().toISOString(),
      };
      setApplySessionHistory((prev) => [createdEvent, ...prev].slice(0, 20));
      setMessage(t('flow.messages.applicationCreated'));
    } catch (err) {
      const statusCode = (err as ApiClientError | undefined)?.statusCode;
      if (statusCode === 409) {
        const duplicateEvent: ApplySessionHistoryItem = {
          applicationId: null,
          jobId,
          resumeId: tailoredResumeId,
          outcome: 'duplicate',
          createdAt: new Date().toISOString(),
        };
        setApplySessionHistory((prev) => [duplicateEvent, ...prev].slice(0, 20));
        setMessage(t('flow.messages.applicationDuplicate'));
        return;
      }

      logError('product-flow-page', 'Failed to create application from flow', err);
      setError(t('flow.errors.applicationFailed'));
    } finally {
      setIsApplying(false);
    }
  };

  const handleStartNextJob = () => {
    setJobDescription('');
    setJobId(null);
    setPreviewResult(null);
    setTailoredResumeId(null);
    setApplicationId(null);
    setError(null);
    setMessage(t('flow.messages.readyForNextJob'));
  };

  const handleClearSessionHistory = () => {
    setApplySessionHistory([]);
    setHistoryFilter('all');
    setError(null);
    setMessage(t('flow.messages.sessionHistoryCleared'));
  };

  const handleExportSessionHistory = () => {
    if (applySessionHistory.length === 0) return;

    const payload = {
      exported_at: new Date().toISOString(),
      total: applySessionHistory.length,
      entries: applySessionHistory,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadBlobAsFile(blob, `flow-apply-session-history-${stamp}.json`);
    setError(null);
    setMessage(t('flow.messages.sessionHistoryExported'));
  };

  const summaryChanges = previewResult?.data?.diff_summary?.total_changes ?? 0;

  return (
    <div className="space-y-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-[color:var(--border)] bg-white px-6 py-5 shadow-[0_18px_34px_rgba(15,27,45,0.12)] md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--text-subtle)]">
              Quy trinh ung tu AI
            </p>
            <h1 className="text-3xl font-semibold text-[var(--foreground)] md:text-4xl">
              {t('flow.title')}
            </h1>
            <p className="text-sm text-[color:var(--text-muted)]">{t('flow.subtitle')}</p>
            {openedFromFocusedJob ? (
              <p className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-800">
                {t('flow.messages.openedFromFocusedJob')}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard">
              <Button variant="outline">{t('nav.backToDashboard')}</Button>
            </Link>
            <Button variant="outline" onClick={() => router.push(jobsReturnHref)}>
              {t('flow.actions.backToJobsContext')}
            </Button>
            {tailoredResumeId && (
              <Button onClick={() => router.push(`/resumes/${tailoredResumeId}`)}>
                {t('flow.actions.openTailoredResume')}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <StepCard
            title={t('flow.steps.masterCv')}
            done={stepState.hasMasterResume}
            doneLabel={t('flow.status.done')}
            pendingLabel={t('flow.status.pending')}
          />
          <StepCard
            title={t('flow.steps.jobDescription')}
            done={stepState.hasJobDescription}
            doneLabel={t('flow.status.done')}
            pendingLabel={t('flow.status.pending')}
          />
          <StepCard
            title={t('flow.steps.previewReady')}
            done={stepState.hasPreview}
            doneLabel={t('flow.status.done')}
            pendingLabel={t('flow.status.pending')}
          />
          <StepCard
            title={t('flow.steps.pdfReady')}
            done={stepState.hasConfirmedTailoredResume}
            doneLabel={t('flow.status.done')}
            pendingLabel={t('flow.status.pending')}
          />
        </div>

        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
          {stepState.hasApplication
            ? t('flow.sections.applicationStatusReady')
            : t('flow.sections.applicationStatusPending')}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[color:var(--border)] bg-white p-5 shadow-[0_16px_28px_rgba(15,27,45,0.08)]">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
              {t('flow.sections.stepA')}
            </h2>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">
              {t('flow.sections.stepADescription')}
            </p>
            <div className="mt-4">
              <ResumeUploadDialog
                open={isUploadDialogOpen}
                onOpenChange={setIsUploadDialogOpen}
                onUploadComplete={handleUploadComplete}
                trigger={<Button>{t('flow.actions.uploadMasterCv')}</Button>}
              />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
              {t('flow.sections.currentMasterResume', {
                value: masterResumeId || t('flow.sections.notSet'),
              })}
            </p>
          </section>

          <section className="rounded-2xl border border-[color:var(--border)] bg-white p-5 shadow-[0_16px_28px_rgba(15,27,45,0.08)]">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
              {t('flow.sections.stepB')}
            </h2>
            <Textarea
              value={jobDescription}
              onChange={(e) => handleJobDescriptionChange(e.target.value)}
              rows={10}
              placeholder={t('flow.sections.jobDescriptionPlaceholder')}
              className="mt-3"
            />
            <div className="mt-3 flex items-center gap-3">
              <Button onClick={handleGeneratePreview} disabled={isGenerating || !masterResumeId}>
                {isGenerating ? t('common.generating') : t('flow.actions.generatePreview')}
              </Button>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                {jobId
                  ? t('flow.sections.jobIdLabelReady', { jobId })
                  : t('flow.sections.jobIdLabelPending')}
              </span>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-[color:var(--border)] bg-blue-50 p-5 shadow-[0_16px_28px_rgba(15,27,45,0.08)]">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
            {t('flow.sections.stepC')}
          </h2>
          <p className="mt-2 text-sm text-blue-900/80">
            {t('flow.sections.previewSummaryPrefix')}{' '}
            <strong>{summaryChanges}</strong> {t('flow.sections.previewSummarySuffix')}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button onClick={handleConfirm} disabled={!previewResult || isConfirming}>
              {isConfirming ? t('flow.actions.confirming') : t('flow.actions.confirmAndCreate')}
            </Button>
            <Button
              variant="outline"
              onClick={openPdfPreview}
              disabled={!tailoredResumeId}
            >
              {t('flow.actions.openPdf')}
            </Button>
            <Button
              variant="outline"
              onClick={() => tailoredResumeId && router.push(`/resumes/${tailoredResumeId}`)}
              disabled={!tailoredResumeId}
            >
              {t('flow.actions.openResumeViewer')}
            </Button>
            <Button onClick={handleApplyNow} disabled={!tailoredResumeId || !jobId || isApplying}>
              {isApplying ? t('flow.actions.applying') : t('flow.actions.applyNow')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                router.push(
                  buildApplicationsHref({
                    nextJobId: jobId || '',
                    nextApplicationId: applicationId || '',
                    nextCandidateId: flowCandidateId,
                  })
                );
              }}
            >
              {t('flow.actions.openApplications')}
            </Button>
            <Button variant="outline" onClick={handleStartNextJob} disabled={!stepState.canStartNextJob}>
              {t('flow.actions.startNextJob')}
            </Button>
          </div>

          <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                {t('flow.sessionHistory.title')}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportSessionHistory}
                  disabled={applySessionHistory.length === 0}
                >
                  {t('flow.sessionHistory.exportAction')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearSessionHistory}
                  disabled={applySessionHistory.length === 0}
                >
                  {t('flow.sessionHistory.clearAction')}
                </Button>
              </div>
            </div>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
              {t('flow.sessionHistory.count', { count: filteredSessionHistory.length })}
            </p>
            {historyFilter !== 'all' && (
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                {t('flow.sessionHistory.filteredFromTotal', { count: applySessionHistory.length })}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={historyFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setHistoryFilter('all')}
              >
                {t('flow.sessionHistory.filterAll')}
              </Button>
              <Button
                size="sm"
                variant={historyFilter === 'created' ? 'default' : 'outline'}
                onClick={() => setHistoryFilter('created')}
              >
                {t('flow.sessionHistory.filterCreated')}
              </Button>
              <Button
                size="sm"
                variant={historyFilter === 'duplicate' ? 'default' : 'outline'}
                onClick={() => setHistoryFilter('duplicate')}
              >
                {t('flow.sessionHistory.filterDuplicate')}
              </Button>
            </div>
            {filteredSessionHistory.length === 0 ? (
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                {t('flow.sessionHistory.empty')}
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {prioritizedSessionHistory.slice(0, 5).map((item, index) => {
                  const isTarget = isFlowReturnTarget(item);

                  return (
                    <li
                      key={`${item.createdAt}-${item.jobId}-${index}`}
                      ref={isTarget ? flowReturnTargetRef : null}
                      data-flow-return-target={isTarget ? 'true' : 'false'}
                      className={`rounded-xl border p-3 ${
                        isTarget
                          ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200'
                          : 'border-[color:var(--border)] bg-white'
                      }`}
                    >
                      {isTarget ? (
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-800">
                          {t('flow.sessionHistory.returnFocusBadge')}
                        </p>
                      ) : null}
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--foreground)]">
                        {t(
                          item.outcome === 'created'
                            ? 'flow.sessionHistory.statusCreated'
                            : 'flow.sessionHistory.statusDuplicate'
                        )}
                      </p>
                      <p className="text-xs text-[color:var(--text-muted)]">
                        {t('flow.sessionHistory.jobId', { jobId: item.jobId })}
                      </p>
                      <p className="text-xs text-[color:var(--text-muted)]">
                        {t('flow.sessionHistory.resumeId', { resumeId: item.resumeId })}
                      </p>
                      <p className="text-xs text-[color:var(--text-muted)]">
                        {item.applicationId
                          ? t('flow.sessionHistory.applicationId', {
                              applicationId: item.applicationId,
                            })
                          : t('flow.sessionHistory.applicationIdPending')}
                      </p>
                      <p className="text-xs text-[color:var(--text-muted)]">
                        {t('flow.sessionHistory.when', {
                          value: formatRelativeSessionTime(item.createdAt),
                        })}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            router.push(
                              buildApplicationsHref({
                                nextJobId: item.jobId,
                                nextApplicationId: item.applicationId || '',
                                nextCandidateId: flowCandidateId,
                              })
                            );
                          }}
                        >
                          {t('flow.sessionHistory.openApplicationsForItem')}
                        </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          router.push(buildJobBoardHref(item.jobId));
                        }}
                      >
                        {t('flow.sessionHistory.openJobBoardForItem')}
                      </Button>
                      {item.applicationId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const applicationId = item.applicationId;
                            if (!applicationId) return;
                            router.push(
                              buildApplicationsHref({
                                nextJobId: item.jobId,
                                nextApplicationId: applicationId,
                                nextCandidateId: flowCandidateId,
                                openPanel: 'status-history',
                              })
                            );
                          }}
                        >
                          {t('flow.sessionHistory.openStatusHistoryForItem')}
                        </Button>
                      ) : null}
                      {item.applicationId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const applicationId = item.applicationId;
                            if (!applicationId) return;
                            router.push(
                              buildApplicationsHref({
                                nextJobId: item.jobId,
                                nextApplicationId: applicationId,
                                nextCandidateId: flowCandidateId,
                                openPanel: 'status-changes',
                              })
                            );
                          }}
                        >
                          {t('flow.sessionHistory.openStatusChangesForItem')}
                        </Button>
                      ) : null}
                      {item.applicationId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const applicationId = item.applicationId;
                            if (!applicationId) return;
                            router.push(
                              buildApplicationsHref({
                                nextJobId: item.jobId,
                                nextApplicationId: applicationId,
                                nextCandidateId: flowCandidateId,
                                openPanel: 'feedback',
                              })
                            );
                          }}
                        >
                          {t('flow.sessionHistory.openFeedbackForItem')}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/resumes/${item.resumeId}`)}
                      >
                        {t('flow.sessionHistory.openResumeForItem')}
                      </Button>
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function StepCard({
  title,
  done,
  doneLabel,
  pendingLabel,
}: {
  title: string;
  done: boolean;
  doneLabel: string;
  pendingLabel: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        done ? 'border-emerald-200 bg-emerald-50' : 'border-[color:var(--border)] bg-white'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
        {title}
      </p>
      <p className={`mt-1 text-xs ${done ? 'text-emerald-800' : 'text-[color:var(--text-subtle)]'}`}>
        {done ? doneLabel : pendingLabel}
      </p>
    </div>
  );
}
