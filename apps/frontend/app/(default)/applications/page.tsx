'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from '@/lib/i18n';
import { useAuth } from '@/lib/context/auth-context';

import {
  bulkUpdateApplicationStatus,
  fetchApplicationFeedback,
  fetchCandidateApplicationHistory,
  exportRecentStatusChangesCsv,
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
import { downloadBlobAsFile } from '@/lib/utils/download';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const STATUS_OPTIONS: ApplicationStatus[] = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'];
const AI_STATUS_OPTIONS: ApplicationAiStatus[] = ['pending', 'parsing', 'scoring', 'completed', 'failed'];
const STATUS_CHANGES_PRESETS = [
  'all-time',
  '7d',
  '30d',
  '90d',
  'this-week',
  'this-month',
  'qtd',
  'ytd',
] as const;
type StatusChangesPreset = (typeof STATUS_CHANGES_PRESETS)[number];
const RANKED_DATE_PRESETS = ['all-time', '7d', 'this-month', 'qtd'] as const;
type RankedDatePreset = (typeof RANKED_DATE_PRESETS)[number];
const STATUS_CHANGES_FOCUS_SEEK_DEBOUNCE_MS = 180;
type FocusMode = 'focus' | 'all';
type FlowReturnPanel = '' | 'status-history' | 'status-changes' | 'feedback';

function parseBooleanQueryFlag(value: string | null): boolean {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true';
}

function parseStatusFilter(value: string | null): ApplicationStatus | '' {
  if (!value) return '';
  return STATUS_OPTIONS.includes(value as ApplicationStatus) ? (value as ApplicationStatus) : '';
}

function parseStatusChangesPreset(value: string | null): StatusChangesPreset | '' {
  if (!value) return '';
  return STATUS_CHANGES_PRESETS.includes(value as StatusChangesPreset)
    ? (value as StatusChangesPreset)
    : '';
}

function parseRankedDatePreset(value: string | null): RankedDatePreset | '' {
  if (!value) return '';
  return RANKED_DATE_PRESETS.includes(value as RankedDatePreset) ? (value as RankedDatePreset) : '';
}

function parseFocusMode(value: string | null): FocusMode | '' {
  if (!value) return '';
  return value === 'focus' || value === 'all' ? value : '';
}

function formatLocalDateInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolvePresetDateRange(preset: Exclude<RankedDatePreset, 'all-time'>): {
  changedAfter: string;
  changedBefore: string;
} {
  const today = new Date();
  const from = new Date(today);

  if (preset === 'this-month') {
    from.setDate(1);
  } else if (preset === 'qtd') {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    from.setMonth(quarterStartMonth, 1);
  } else {
    from.setDate(today.getDate() - 6);
  }

  return {
    changedAfter: formatLocalDateInput(from),
    changedBefore: formatLocalDateInput(today),
  };
}

function parsePositiveInteger(value: string | null): number {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function badgeClass(status: ApplicationStatus): string {
  switch (status) {
    case 'hired':
      return 'bg-green-100 text-green-800 border-green-400';
    case 'offer':
      return 'bg-purple-100 text-purple-800 border-purple-400';
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
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isRecruiterOrAdmin = user?.role === 'recruiter' || user?.role === 'admin';
  const isCandidateOnly = user?.role === 'candidate';
  const defaultJobId = searchParams.get('job_id') || '';
  const defaultApplicationId = searchParams.get('application_id') || '';
  const defaultCandidateId = searchParams.get('candidate_id') || '';
  const defaultStatusChangesFilter = parseStatusFilter(searchParams.get('sc_status'));
  const defaultStatusChangesChangedBy = searchParams.get('sc_changed_by') || '';
  const defaultStatusChangesChangedAfter = searchParams.get('sc_after') || '';
  const defaultStatusChangesChangedBefore = searchParams.get('sc_before') || '';
  const defaultStatusChangesPreset = parseStatusChangesPreset(searchParams.get('sc_preset'));
  const defaultStatusChangesPage = parsePositiveInteger(searchParams.get('sc_page'));
  const defaultRankedChangedByFilter = searchParams.get('rc_changed_by') || '';
  const defaultRankedChangedAfterRaw = searchParams.get('rc_after') || '';
  const defaultRankedChangedBeforeRaw = searchParams.get('rc_before') || '';
  const defaultRankedDatePreset = parseRankedDatePreset(searchParams.get('rc_preset'));
  const defaultRankedDateRange =
    !defaultRankedChangedAfterRaw &&
    !defaultRankedChangedBeforeRaw &&
    defaultRankedDatePreset &&
    defaultRankedDatePreset !== 'all-time'
      ? resolvePresetDateRange(defaultRankedDatePreset)
      : null;
  const defaultRankedChangedAfter =
    defaultRankedChangedAfterRaw || defaultRankedDateRange?.changedAfter || '';
  const defaultRankedChangedBefore =
    defaultRankedChangedBeforeRaw || defaultRankedDateRange?.changedBefore || '';
  const defaultFocusMode = parseFocusMode(searchParams.get('rc_focus'));
  const defaultOpenStatusHistory = parseBooleanQueryFlag(searchParams.get('sh_open'));
  const defaultOpenStatusChanges = parseBooleanQueryFlag(searchParams.get('sc_open'));
  const defaultOpenFeedback = parseBooleanQueryFlag(searchParams.get('fb_open'));
  const defaultCandidateFocus = parseBooleanQueryFlag(searchParams.get('candidate_focus'));
  const defaultFlowReturnPanel: FlowReturnPanel = defaultOpenStatusHistory
    ? 'status-history'
    : defaultOpenStatusChanges
      ? 'status-changes'
      : defaultOpenFeedback
        ? 'feedback'
        : '';
  const isFlowContext = parseBooleanQueryFlag(searchParams.get('flow_ctx'));

  const [jobId, setJobId] = useState(defaultJobId);
  const [focusApplicationId, setFocusApplicationId] = useState(defaultApplicationId);
  const [focusOnlyMode, setFocusOnlyMode] = useState(
    Boolean(defaultApplicationId) && defaultFocusMode !== 'all'
  );
  const [candidateFocusEnabled, setCandidateFocusEnabled] = useState(
    Boolean(defaultApplicationId) && defaultCandidateFocus
  );
  const [candidateId, setCandidateId] = useState(defaultCandidateId);
  const [rankedStatusFilter, setRankedStatusFilter] = useState<ApplicationStatus | ''>('');
  const [rankedChangedByFilter, setRankedChangedByFilter] = useState(defaultRankedChangedByFilter);
  const [rankedChangedAfter, setRankedChangedAfter] = useState(defaultRankedChangedAfter);
  const [rankedChangedBefore, setRankedChangedBefore] = useState(defaultRankedChangedBefore);
  const [rankedDatePreset, setRankedDatePreset] = useState<RankedDatePreset | ''>(defaultRankedDatePreset);
  const [isRankedSummaryAnimating, setIsRankedSummaryAnimating] = useState(false);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<ApplicationStatus | ''>('');
  const [rankedItems, setRankedItems] = useState<RankedCandidateItem[]>([]);
  const [selectedRankedApplicationIds, setSelectedRankedApplicationIds] = useState<string[]>([]);
  const [bulkRankedStatus, setBulkRankedStatus] = useState<ApplicationStatus | ''>('');
  const [isApplyingBulkStatus, setIsApplyingBulkStatus] = useState(false);
  const [isUndoingBulkStatus, setIsUndoingBulkStatus] = useState(false);
  const [bulkRankedStatusResult, setBulkRankedStatusResult] = useState<{
    requestedCount: number;
    matchedCount: number;
    updatedCount: number;
    unchangedCount: number;
    status: ApplicationStatus;
  } | null>(null);
  const [bulkRankedUndoPayload, setBulkRankedUndoPayload] = useState<
    Array<{ applicationId: string; previousStatus: ApplicationStatus }>
  >([]);
  const [bulkRankedUndoResult, setBulkRankedUndoResult] = useState<{ revertedCount: number } | null>(null);
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
  const [isSeekingFocusedApplication, setIsSeekingFocusedApplication] = useState(false);
  const [isSeekingFocusedHistoryItem, setIsSeekingFocusedHistoryItem] = useState(false);
  const [isSeekingFocusedStatusChanges, setIsSeekingFocusedStatusChanges] = useState(false);
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
  const [statusChangesFilter, setStatusChangesFilter] = useState<ApplicationStatus | ''>(
    defaultStatusChangesFilter
  );
  const [statusChangesChangedBy, setStatusChangesChangedBy] = useState(defaultStatusChangesChangedBy);
  const [statusChangesChangedAfter, setStatusChangesChangedAfter] = useState(
    defaultStatusChangesChangedAfter
  );
  const [statusChangesChangedBefore, setStatusChangesChangedBefore] = useState(
    defaultStatusChangesChangedBefore
  );
  const [statusChangesPreset, setStatusChangesPreset] = useState<StatusChangesPreset | ''>(
    defaultStatusChangesPreset
  );
  const [statusChangesPage, setStatusChangesPage] = useState(defaultStatusChangesPage);
  const [statusChangesTotalPages, setStatusChangesTotalPages] = useState(1);
  const [statusChangesTotal, setStatusChangesTotal] = useState(0);
  const [statusChangesActivated, setStatusChangesActivated] = useState(Boolean(defaultJobId));
  const [isStatusChangesSummaryAnimating, setIsStatusChangesSummaryAnimating] = useState(false);
  const [isExportingStatusChanges, setIsExportingStatusChanges] = useState(false);
  const [pendingStatusHistoryApplicationId, setPendingStatusHistoryApplicationId] = useState(
    defaultOpenStatusHistory ? defaultApplicationId : ''
  );
  const [statusChangesFocusApplicationId, setStatusChangesFocusApplicationId] = useState(
    defaultOpenStatusChanges ? defaultApplicationId : ''
  );
  const [pendingFeedbackApplicationId, setPendingFeedbackApplicationId] = useState(
    defaultOpenFeedback ? defaultApplicationId : ''
  );
  const [flowReturnPanel, setFlowReturnPanel] = useState<FlowReturnPanel>(defaultFlowReturnPanel);
  const [error, setError] = useState<string | null>(null);
  const focusSeekAttemptedKeyRef = useRef<string>('');
  const focusSeekRunIdRef = useRef(0);
  const candidateFocusSeekAttemptedKeyRef = useRef<string>('');
  const candidateFocusSeekRunIdRef = useRef(0);
  const statusChangesFocusSeekAttemptedKeyRef = useRef<string>('');
  const statusChangesFocusSeekRunIdRef = useRef(0);
  const focusedCardRef = useRef<HTMLDivElement | null>(null);
  const candidateFocusedHistoryRef = useRef<HTMLDivElement | null>(null);
  const statusChangesCardRef = useRef<HTMLDivElement | null>(null);
  const statusChangesFocusedRowRef = useRef<HTMLDivElement | null>(null);
  const statusChangesDeepLinkHandledRef = useRef(false);

  useEffect(() => {
    if (!isCandidateOnly || !user?.id) return;
    setCandidateId(user.id);
    setHistoryActivated(true);
    setHistoryPage(1);
  }, [isCandidateOnly, user?.id]);

  const topHybrid = useMemo(() => {
    if (!rankedItems.length) return null;
    return rankedItems[0].scores.hybrid_score;
  }, [rankedItems]);

  const focusedRankedItem = useMemo(() => {
    if (!focusApplicationId.trim()) return null;
    return rankedItems.find((item) => item.application_id === focusApplicationId.trim()) || null;
  }, [focusApplicationId, rankedItems]);

  const displayedRankedItems = useMemo(() => {
    if (focusOnlyMode && focusedRankedItem) {
      return rankedItems.filter((item) => item.application_id === focusedRankedItem.application_id);
    }
    return rankedItems;
  }, [focusOnlyMode, focusedRankedItem, rankedItems]);

  const focusedHistoryItem = useMemo(() => {
    if (!candidateFocusEnabled || !focusApplicationId.trim()) return null;
    return (
      historyItems.find((item) => item.application_id === focusApplicationId.trim()) || null
    );
  }, [candidateFocusEnabled, focusApplicationId, historyItems]);

  const statusChangesFocusedVisible = useMemo(() => {
    if (!statusChangesFocusApplicationId.trim()) return false;
    return statusChanges.some(
      (item) => item.application_id === statusChangesFocusApplicationId.trim()
    );
  }, [statusChanges, statusChangesFocusApplicationId]);

  const flowReturnQuerySnapshot = useMemo(() => {
    const next = new URLSearchParams(searchParams.toString());
    // Keep only recruiter view state; volatile deep-link params are restored from dedicated flow keys.
    next.delete('flow_ctx');
    next.delete('job_id');
    next.delete('application_id');
    next.delete('candidate_id');
    next.delete('sh_open');
    next.delete('sc_open');
    next.delete('fb_open');

    if (flowReturnPanel) {
      next.set('flow_panel', flowReturnPanel);
    } else {
      next.delete('flow_panel');
    }

    return next.toString();
  }, [searchParams, flowReturnPanel]);

  const flowReturnHref = useMemo(() => {
    if (!isFlowContext) return '/flow';

    const params = new URLSearchParams();
    if (jobId.trim()) {
      params.set('flow_return_job_id', jobId.trim());
    }

    const returnApplicationId = focusApplicationId.trim() || defaultApplicationId.trim();
    if (returnApplicationId) {
      params.set('flow_return_application_id', returnApplicationId);
    }

    if (flowReturnQuerySnapshot) {
      params.set('flow_return_query', flowReturnQuerySnapshot);
    }

    const query = params.toString();
    return query ? `/flow?${query}` : '/flow';
  }, [isFlowContext, jobId, focusApplicationId, defaultApplicationId, flowReturnQuerySnapshot]);

  const focusSeekKey = useMemo(() => {
    return JSON.stringify({
      focusApplicationId: focusApplicationId.trim(),
      jobId: jobId.trim(),
      rankedStatusFilter,
      rankedChangedByFilter: rankedChangedByFilter.trim(),
      rankedChangedAfter,
      rankedChangedBefore,
    });
  }, [
    focusApplicationId,
    jobId,
    rankedStatusFilter,
    rankedChangedByFilter,
    rankedChangedAfter,
    rankedChangedBefore,
  ]);

  const candidateFocusSeekKey = useMemo(() => {
    return JSON.stringify({
      focusApplicationId: focusApplicationId.trim(),
      candidateId: candidateId.trim(),
      historyStatusFilter,
    });
  }, [focusApplicationId, candidateId, historyStatusFilter]);

  const statusChangesFocusSeekKey = useMemo(() => {
    return JSON.stringify({
      focusApplicationId: statusChangesFocusApplicationId.trim(),
      jobId: jobId.trim(),
      statusChangesFilter,
      statusChangesChangedBy: statusChangesChangedBy.trim(),
      statusChangesChangedAfter,
      statusChangesChangedBefore,
    });
  }, [
    statusChangesFocusApplicationId,
    jobId,
    statusChangesFilter,
    statusChangesChangedBy,
    statusChangesChangedAfter,
    statusChangesChangedBefore,
  ]);

  const statusLabel = useCallback(
    (status: ApplicationStatus) => t(`applicationsPage.status.${status}`),
    [t]
  );

  const applyStatusChangesPreset = useCallback(
    (preset: StatusChangesPreset) => {
    const today = new Date();
    const from = new Date(today);

    if (preset === 'all-time') {
      setStatusChangesPreset(preset);
      setStatusChangesChangedAfter('');
      setStatusChangesChangedBefore('');
      setStatusChangesPage(1);
      return;
    }

    if (preset === 'this-week') {
      // Monday-start week to align with recruiter reporting conventions.
      const day = (today.getDay() + 6) % 7;
      from.setDate(today.getDate() - day);
    } else if (preset === 'this-month') {
      from.setDate(1);
    } else if (preset === 'qtd') {
      const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
      from.setMonth(quarterStartMonth, 1);
    } else if (preset === 'ytd') {
      from.setMonth(0, 1);
    } else {
      const days = Number.parseInt(preset.replace('d', ''), 10);
      from.setDate(today.getDate() - (days - 1));
    }

    setStatusChangesPreset(preset);
    setStatusChangesChangedAfter(formatLocalDateInput(from));
    setStatusChangesChangedBefore(formatLocalDateInput(today));
    setStatusChangesPage(1);
    },
    []
  );

  const aiStatusLabel = useCallback(
    (status: ApplicationAiStatus) => t(`applicationsPage.aiStatus.${status}`),
    [t]
  );

  const applyRankedDatePreset = useCallback((preset: RankedDatePreset) => {
    if (preset === 'all-time') {
      setRankedDatePreset(preset);
      setRankedChangedAfter('');
      setRankedChangedBefore('');
      setRankedPage(1);
      return;
    }

    const today = new Date();
    const from = new Date(today);

    if (preset === 'this-month') {
      from.setDate(1);
    } else if (preset === 'qtd') {
      const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
      from.setMonth(quarterStartMonth, 1);
    } else {
      from.setDate(today.getDate() - 6);
    }

    setRankedDatePreset(preset);
    setRankedChangedAfter(formatLocalDateInput(from));
    setRankedChangedBefore(formatLocalDateInput(today));
    setRankedPage(1);
  }, []);

  const rankedFilterSummary = useMemo(() => {
    const tokens: Array<{
      id: 'preset' | 'status' | 'changedBy' | 'from' | 'to' | 'focus';
      label: string;
    }> = [];

    if (rankedDatePreset) {
      tokens.push({
        id: 'preset',
        label: t(`applicationsPage.recruiterView.preset.${rankedDatePreset}`),
      });
    }
    if (rankedStatusFilter) {
      tokens.push({
        id: 'status',
        label: t('applicationsPage.recruiterView.summaryStatus', {
          status: statusLabel(rankedStatusFilter),
        }),
      });
    }
    if (rankedChangedByFilter.trim()) {
      tokens.push({
        id: 'changedBy',
        label: t('applicationsPage.recruiterView.summaryChangedBy', {
          changedBy: rankedChangedByFilter.trim(),
        }),
      });
    }
    if (rankedChangedAfter) {
      tokens.push({
        id: 'from',
        label: t('applicationsPage.recruiterView.summaryFrom', { date: rankedChangedAfter }),
      });
    }
    if (rankedChangedBefore) {
      tokens.push({
        id: 'to',
        label: t('applicationsPage.recruiterView.summaryTo', { date: rankedChangedBefore }),
      });
    }
    if (focusApplicationId.trim()) {
      tokens.push({
        id: 'focus',
        label: t('applicationsPage.recruiterView.summaryFocusedApplication', {
          applicationId: focusApplicationId.trim(),
        }),
      });
    }

    return tokens;
  }, [
    rankedDatePreset,
    rankedStatusFilter,
    rankedChangedByFilter,
    rankedChangedAfter,
    rankedChangedBefore,
    focusApplicationId,
    statusLabel,
    t,
  ]);

  const removeRankedFilterChip = useCallback((chipId: 'preset' | 'status' | 'changedBy' | 'from' | 'to' | 'focus') => {
    switch (chipId) {
      case 'preset':
        setRankedDatePreset('');
        setRankedChangedAfter('');
        setRankedChangedBefore('');
        break;
      case 'status':
        setRankedStatusFilter('');
        break;
      case 'changedBy':
        setRankedChangedByFilter('');
        break;
      case 'from':
        setRankedDatePreset('');
        setRankedChangedAfter('');
        break;
      case 'to':
        setRankedDatePreset('');
        setRankedChangedBefore('');
        break;
      case 'focus':
        setFocusApplicationId('');
        setFocusOnlyMode(false);
        break;
    }
    setRankedPage(1);
    setIsRankedSummaryAnimating(true);
  }, []);

  const clearRankedSummaryFilters = useCallback(() => {
    setRankedDatePreset('');
    setRankedStatusFilter('');
    setRankedChangedByFilter('');
    setRankedChangedAfter('');
    setRankedChangedBefore('');
    setFocusApplicationId('');
    setFocusOnlyMode(false);
    setRankedPage(1);
    setRankedActivated(true);
    setIsRankedSummaryAnimating(true);
  }, []);

  useEffect(() => {
    if (!isRankedSummaryAnimating) return;
    const timer = window.setTimeout(() => {
      setIsRankedSummaryAnimating(false);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [isRankedSummaryAnimating]);

  const statusChangesFilterSummary = useMemo(() => {
    const tokens: Array<{
      id: 'preset' | 'status' | 'changedBy' | 'from' | 'to';
      label: string;
    }> = [];

    if (statusChangesPreset) {
      tokens.push({
        id: 'preset',
        label: t(`applicationsPage.statusChanges.preset.${statusChangesPreset}`),
      });
    }
    if (statusChangesFilter) {
      tokens.push({
        id: 'status',
        label: t('applicationsPage.statusChanges.summaryStatus', {
          status: statusLabel(statusChangesFilter),
        }),
      });
    }
    if (statusChangesChangedBy.trim()) {
      tokens.push({
        id: 'changedBy',
        label: t('applicationsPage.statusChanges.summaryChangedBy', {
          changedBy: statusChangesChangedBy.trim(),
        }),
      });
    }
    if (statusChangesChangedAfter) {
      tokens.push({
        id: 'from',
        label: t('applicationsPage.statusChanges.summaryFrom', { date: statusChangesChangedAfter }),
      });
    }
    if (statusChangesChangedBefore) {
      tokens.push({
        id: 'to',
        label: t('applicationsPage.statusChanges.summaryTo', { date: statusChangesChangedBefore }),
      });
    }

    return tokens;
  }, [
    statusChangesPreset,
    statusChangesFilter,
    statusChangesChangedBy,
    statusChangesChangedAfter,
    statusChangesChangedBefore,
    statusLabel,
    t,
  ]);

  const removeStatusChangesFilterChip = useCallback(
    (chipId: 'preset' | 'status' | 'changedBy' | 'from' | 'to') => {
      switch (chipId) {
        case 'preset':
          setStatusChangesPreset('');
          setStatusChangesChangedAfter('');
          setStatusChangesChangedBefore('');
          break;
        case 'status':
          setStatusChangesFilter('');
          break;
        case 'changedBy':
          setStatusChangesChangedBy('');
          break;
        case 'from':
          setStatusChangesPreset('');
          setStatusChangesChangedAfter('');
          break;
        case 'to':
          setStatusChangesPreset('');
          setStatusChangesChangedBefore('');
          break;
      }
      setStatusChangesPage(1);
      setIsStatusChangesSummaryAnimating(true);
    },
    []
  );

  const clearStatusChangesSummaryFilters = useCallback(() => {
    setStatusChangesPreset('');
    setStatusChangesFilter('');
    setStatusChangesChangedBy('');
    setStatusChangesChangedAfter('');
    setStatusChangesChangedBefore('');
    setStatusChangesPage(1);
    setStatusChangesActivated(true);
    setIsStatusChangesSummaryAnimating(true);
  }, []);

  useEffect(() => {
    if (!isStatusChangesSummaryAnimating) return;
    const timer = window.setTimeout(() => {
      setIsStatusChangesSummaryAnimating(false);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [isStatusChangesSummaryAnimating]);

  useEffect(() => {
    if (focusApplicationId.trim()) return;
    setFocusOnlyMode(false);
    setCandidateFocusEnabled(false);
    setFlowReturnPanel('');
    setStatusChangesFocusApplicationId('');
  }, [focusApplicationId]);

  useEffect(() => {
    if (!isCandidateOnly || !focusedHistoryItem) return;

    const timer = window.setTimeout(() => {
      candidateFocusedHistoryRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isCandidateOnly, focusedHistoryItem?.application_id, historyPage]);

  useEffect(() => {
    if (!isCandidateOnly || !candidateFocusEnabled || !focusApplicationId.trim()) {
      candidateFocusSeekRunIdRef.current += 1;
      candidateFocusSeekAttemptedKeyRef.current = '';
      setIsSeekingFocusedHistoryItem(false);
      return;
    }

    if (!historyActivated || !candidateId.trim()) return;
    if (isLoadingHistory) return;
    if (focusedHistoryItem) return;
    if (historyTotalPages <= 1) return;

    if (candidateFocusSeekAttemptedKeyRef.current === candidateFocusSeekKey) {
      return;
    }

    candidateFocusSeekAttemptedKeyRef.current = candidateFocusSeekKey;
    const runId = candidateFocusSeekRunIdRef.current + 1;
    candidateFocusSeekRunIdRef.current = runId;

    let cancelled = false;
    const seekFocusedHistoryItem = async () => {
      if (cancelled || candidateFocusSeekRunIdRef.current !== runId) return;
      setIsSeekingFocusedHistoryItem(true);
      try {
        for (let page = 1; page <= historyTotalPages; page += 1) {
          if (page === historyPage) continue;

          const result = await fetchCandidateApplicationHistory({
            candidateId: candidateId.trim(),
            limit: 20,
            page,
            status: historyStatusFilter,
          });

          if (cancelled || candidateFocusSeekRunIdRef.current !== runId) return;

          const isMatch = result.data.applications.some(
            (item) => item.application_id === focusApplicationId.trim()
          );
          if (isMatch) {
            setHistoryPage(page);
            return;
          }
        }
      } catch {
        // Keep current history view and focus hints if background seek fails.
      } finally {
        if (!cancelled && candidateFocusSeekRunIdRef.current === runId) {
          setIsSeekingFocusedHistoryItem(false);
        }
      }
    };

    void seekFocusedHistoryItem();
    return () => {
      cancelled = true;
    };
  }, [
    candidateFocusEnabled,
    candidateFocusSeekKey,
    candidateId,
    focusApplicationId,
    focusedHistoryItem,
    historyActivated,
    historyPage,
    historyStatusFilter,
    historyTotalPages,
    isCandidateOnly,
    isLoadingHistory,
  ]);

  useEffect(() => {
    if (!isRecruiterOrAdmin || !statusChangesFocusApplicationId.trim()) {
      statusChangesFocusSeekRunIdRef.current += 1;
      statusChangesFocusSeekAttemptedKeyRef.current = '';
      setIsSeekingFocusedStatusChanges(false);
      return;
    }

    if (!statusChangesActivated || !jobId.trim()) return;
    if (isLoadingStatusChanges) return;
    if (statusChangesFocusedVisible) return;
    if (statusChangesTotalPages <= 1) return;

    if (statusChangesFocusSeekAttemptedKeyRef.current === statusChangesFocusSeekKey) {
      return;
    }

    statusChangesFocusSeekAttemptedKeyRef.current = statusChangesFocusSeekKey;
    const runId = statusChangesFocusSeekRunIdRef.current + 1;
    statusChangesFocusSeekRunIdRef.current = runId;

    let cancelled = false;
    let debounceTimer: ReturnType<typeof window.setTimeout> | null = null;
    const seekFocusedStatusChange = async () => {
      if (cancelled || statusChangesFocusSeekRunIdRef.current !== runId) return;
      setIsSeekingFocusedStatusChanges(true);
      try {
        for (let page = 1; page <= statusChangesTotalPages; page += 1) {
          if (page === statusChangesPage) continue;

          const result = await fetchRecentStatusChanges({
            jobId: jobId.trim(),
            page,
            limit: 20,
            status: statusChangesFilter,
            changedBy: statusChangesChangedBy,
            changedAfter: statusChangesChangedAfter,
            changedBefore: statusChangesChangedBefore,
          });

          if (cancelled || statusChangesFocusSeekRunIdRef.current !== runId) return;

          const isMatch = result.data.changes.some(
            (item) => item.application_id === statusChangesFocusApplicationId.trim()
          );
          if (isMatch) {
            setStatusChangesPage(page);
            return;
          }
        }
      } catch {
        // Keep current status-changes page and focus hint when background seek fails.
      } finally {
        if (!cancelled && statusChangesFocusSeekRunIdRef.current === runId) {
          setIsSeekingFocusedStatusChanges(false);
        }
      }
    };

    debounceTimer = window.setTimeout(() => {
      void seekFocusedStatusChange();
    }, STATUS_CHANGES_FOCUS_SEEK_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }
    };
  }, [
    isRecruiterOrAdmin,
    statusChangesFocusApplicationId,
    statusChangesActivated,
    jobId,
    isLoadingStatusChanges,
    statusChangesFocusedVisible,
    statusChangesTotalPages,
    statusChangesFocusSeekKey,
    statusChangesPage,
    statusChangesFilter,
    statusChangesChangedBy,
    statusChangesChangedAfter,
    statusChangesChangedBefore,
  ]);

  useEffect(() => {
    if (!isRecruiterOrAdmin || !statusChangesFocusedVisible) return;

    const timer = window.setTimeout(() => {
      statusChangesFocusedRowRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    isRecruiterOrAdmin,
    statusChangesFocusedVisible,
    statusChangesFocusApplicationId,
    statusChangesPage,
  ]);

  useEffect(() => {
    if (!focusedRankedItem) return;

    const timer = window.setTimeout(() => {
      focusedCardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [focusedRankedItem?.application_id, rankedPage]);

  useEffect(() => {
    if (!focusApplicationId.trim()) {
      focusSeekRunIdRef.current += 1;
      focusSeekAttemptedKeyRef.current = '';
      setIsSeekingFocusedApplication(false);
      return;
    }

    if (!rankedActivated || !jobId.trim()) return;
    if (isLoadingRanked) return;
    if (focusedRankedItem) return;
    if (rankedTotalPages <= 1) return;

    if (focusSeekAttemptedKeyRef.current === focusSeekKey) {
      return;
    }

    focusSeekAttemptedKeyRef.current = focusSeekKey;
    const runId = focusSeekRunIdRef.current + 1;
    focusSeekRunIdRef.current = runId;

    let cancelled = false;
    const seekFocusedApplication = async () => {
      if (cancelled || focusSeekRunIdRef.current !== runId) return;
      setIsSeekingFocusedApplication(true);
      try {
        for (let page = 1; page <= rankedTotalPages; page += 1) {
          if (page === rankedPage) continue;

          const result = await fetchRankedApplications({
            jobId: jobId.trim(),
            limit: 20,
            page,
            status: rankedStatusFilter,
            changedBy: rankedChangedByFilter,
            changedAfter: rankedChangedAfter,
            changedBefore: rankedChangedBefore,
          });

          if (cancelled || focusSeekRunIdRef.current !== runId) return;

          const isMatch = result.data.candidates.some(
            (item) => item.application_id === focusApplicationId.trim()
          );
          if (isMatch) {
            setRankedPage(page);
            return;
          }
        }
      } catch {
        // Keep focus fallback message in UI when seek fails.
      } finally {
        if (!cancelled && focusSeekRunIdRef.current === runId) {
          setIsSeekingFocusedApplication(false);
        }
      }
    };

    void seekFocusedApplication();
    return () => {
      cancelled = true;
    };
  }, [
    focusApplicationId,
    focusedRankedItem,
    focusSeekKey,
    isLoadingRanked,
    jobId,
    rankedActivated,
    rankedChangedAfter,
    rankedChangedBefore,
    rankedChangedByFilter,
    rankedPage,
    rankedStatusFilter,
    rankedTotalPages,
  ]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, value: string) => {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    };

    setOrDelete('job_id', jobId.trim());
    setOrDelete('application_id', focusApplicationId.trim());
    setOrDelete(
      'rc_focus',
      isRecruiterOrAdmin && focusApplicationId.trim() ? (focusOnlyMode ? 'focus' : 'all') : ''
    );
    setOrDelete('candidate_id', candidateId.trim());
    setOrDelete(
      'candidate_focus',
      isCandidateOnly && candidateFocusEnabled && focusApplicationId.trim() ? '1' : ''
    );
    setOrDelete('rc_changed_by', rankedChangedByFilter.trim());
    setOrDelete('rc_after', rankedChangedAfter);
    setOrDelete('rc_before', rankedChangedBefore);
    setOrDelete('rc_preset', rankedDatePreset);
    const canShareFocusedPanel = Boolean(focusApplicationId.trim());
    setOrDelete(
      'sh_open',
      canShareFocusedPanel && flowReturnPanel === 'status-history' ? '1' : ''
    );
    setOrDelete(
      'sc_open',
      canShareFocusedPanel && flowReturnPanel === 'status-changes' ? '1' : ''
    );
    setOrDelete('fb_open', canShareFocusedPanel && flowReturnPanel === 'feedback' ? '1' : '');
    setOrDelete('sc_status', statusChangesFilter);
    setOrDelete('sc_changed_by', statusChangesChangedBy.trim());
    setOrDelete('sc_after', statusChangesChangedAfter);
    setOrDelete('sc_before', statusChangesChangedBefore);
    setOrDelete('sc_preset', statusChangesPreset);
    if (statusChangesPage > 1) {
      next.set('sc_page', String(statusChangesPage));
    } else {
      next.delete('sc_page');
    }

    const currentQuery = searchParams.toString();
    const nextQuery = next.toString();
    if (nextQuery === currentQuery) {
      return;
    }

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [
    router,
    pathname,
    searchParams,
    jobId,
    focusApplicationId,
    focusOnlyMode,
    isRecruiterOrAdmin,
    candidateId,
    isCandidateOnly,
    candidateFocusEnabled,
    rankedChangedByFilter,
    rankedChangedAfter,
    rankedChangedBefore,
    rankedDatePreset,
    flowReturnPanel,
    statusChangesFilter,
    statusChangesChangedBy,
    statusChangesChangedAfter,
    statusChangesChangedBefore,
    statusChangesPreset,
    statusChangesPage,
  ]);

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
        changedBy: rankedChangedByFilter,
        changedAfter: rankedChangedAfter,
        changedBefore: rankedChangedBefore,
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
  }, [jobId, rankedPage, rankedStatusFilter, rankedChangedByFilter, rankedChangedAfter, rankedChangedBefore, t]);

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
      await updateApplicationStatus(applicationId, status);
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

  async function handleBulkRankedStatusApply() {
    if (!selectedRankedApplicationIds.length || !bulkRankedStatus) {
      return;
    }

    const previousStatuses = new Map(
      rankedItems
        .filter((item) => selectedRankedApplicationIds.includes(item.application_id))
        .map((item) => [item.application_id, item.status] as const)
    );

    setError(null);
    setBulkRankedStatusResult(null);
    setBulkRankedUndoResult(null);
    setBulkRankedUndoPayload([]);
    setIsApplyingBulkStatus(true);
    try {
      const result = await bulkUpdateApplicationStatus({
        applicationIds: selectedRankedApplicationIds,
        status: bulkRankedStatus,
      });

      const updatedIdSet = new Set(result.data.updated_ids);
      if (updatedIdSet.size) {
        setRankedItems((prev) =>
          prev.map((item) =>
            updatedIdSet.has(item.application_id) ? { ...item, status: bulkRankedStatus } : item
          )
        );
        setHistoryItems((prev) =>
          prev.map((item) =>
            updatedIdSet.has(item.application_id) ? { ...item, status: bulkRankedStatus } : item
          )
        );
      }

      setBulkRankedUndoPayload(
        result.data.updated_ids
          .map((applicationId) => {
            const previousStatus = previousStatuses.get(applicationId);
            if (!previousStatus) return null;
            return { applicationId, previousStatus };
          })
          .filter((item): item is { applicationId: string; previousStatus: ApplicationStatus } =>
            Boolean(item)
          )
      );

      setBulkRankedStatusResult({
        requestedCount: result.data.requested_count,
        matchedCount: result.data.matched_count,
        updatedCount: result.data.updated_count,
        unchangedCount: result.data.unchanged_count,
        status: result.data.status,
      });

      setSelectedRankedApplicationIds([]);
      setBulkRankedStatus('');
      setStatusChangesPage(1);
      setStatusChangesActivated(true);
      void loadRecentStatusChanges();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('applicationsPage.errors.bulkUpdateStatusFailed'));
    } finally {
      setIsApplyingBulkStatus(false);
    }
  }

  async function handleUndoBulkRankedStatusApply() {
    if (!bulkRankedUndoPayload.length) {
      return;
    }

    setError(null);
    setBulkRankedUndoResult(null);
    setIsUndoingBulkStatus(true);
    try {
      const grouped = bulkRankedUndoPayload.reduce(
        (acc, entry) => {
          if (!acc[entry.previousStatus]) {
            acc[entry.previousStatus] = [];
          }
          acc[entry.previousStatus].push(entry.applicationId);
          return acc;
        },
        {} as Record<ApplicationStatus, string[]>
      );

      for (const status of STATUS_OPTIONS) {
        const applicationIds = grouped[status];
        if (!applicationIds?.length) {
          continue;
        }
        await bulkUpdateApplicationStatus({
          applicationIds,
          status,
        });
      }

      const previousStatusMap = new Map(
        bulkRankedUndoPayload.map((entry) => [entry.applicationId, entry.previousStatus] as const)
      );

      setRankedItems((prev) =>
        prev.map((item) => {
          const previousStatus = previousStatusMap.get(item.application_id);
          if (!previousStatus) return item;
          return { ...item, status: previousStatus };
        })
      );
      setHistoryItems((prev) =>
        prev.map((item) => {
          const previousStatus = previousStatusMap.get(item.application_id);
          if (!previousStatus) return item;
          return { ...item, status: previousStatus };
        })
      );

      setBulkRankedUndoResult({ revertedCount: bulkRankedUndoPayload.length });
      setBulkRankedUndoPayload([]);
      setSelectedRankedApplicationIds([]);
      setBulkRankedStatus('');
      setStatusChangesPage(1);
      setStatusChangesActivated(true);
      void loadRecentStatusChanges();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('applicationsPage.errors.undoBulkUpdateStatusFailed'));
    } finally {
      setIsUndoingBulkStatus(false);
    }
  }

  useEffect(() => {
    const visibleIds = new Set(displayedRankedItems.map((item) => item.application_id));
    setSelectedRankedApplicationIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [displayedRankedItems]);

  const openFeedback = useCallback(
    async (applicationId: string) => {
      setError(null);

      try {
        const result = await fetchApplicationFeedback(applicationId);
        setFeedback(result.data);
        setFocusApplicationId(applicationId);
        setFlowReturnPanel('feedback');
      } catch (err) {
        setError(err instanceof Error ? err.message : t('applicationsPage.errors.loadFeedbackFailed'));
      }
    },
    [t]
  );

  const openStatusChanges = useCallback((applicationId: string) => {
    setError(null);
    setFocusApplicationId(applicationId);
    setStatusChangesFocusApplicationId(applicationId);
    setFlowReturnPanel('status-changes');
    setStatusChangesPage(1);
    setStatusChangesActivated(true);

    window.setTimeout(() => {
      statusChangesCardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }, 0);
  }, []);

  const handleExportStatusChanges = useCallback(async () => {
    if (!jobId.trim()) {
      setError(t('applicationsPage.errors.jobIdRequired'));
      return;
    }

    setError(null);
    setIsExportingStatusChanges(true);
    try {
      const blob = await exportRecentStatusChangesCsv({
        jobId: jobId.trim(),
        status: statusChangesFilter,
        changedBy: statusChangesChangedBy,
        changedAfter: statusChangesChangedAfter,
        changedBefore: statusChangesChangedBefore,
      });
      const datePart = new Date().toISOString().slice(0, 10);
      const safeJobId = jobId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      downloadBlobAsFile(blob, `status_changes_${safeJobId || 'job'}_${datePart}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('applicationsPage.errors.exportStatusChangesFailed'));
    } finally {
      setIsExportingStatusChanges(false);
    }
  }, [
    jobId,
    statusChangesFilter,
    statusChangesChangedBy,
    statusChangesChangedAfter,
    statusChangesChangedBefore,
    t,
  ]);

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

  const openStatusHistory = useCallback(
    async (applicationId: string, candidateName?: string) => {
      setError(null);

      try {
        const result = await fetchApplicationStatusHistory(applicationId);
        const resolvedCandidateName =
          candidateName ||
          rankedItems.find((item) => item.application_id === applicationId)?.candidate.full_name ||
          applicationId;
        setSelectedStatusHistory({
          applicationId,
          candidateName: resolvedCandidateName,
          currentStatus: result.data.current_status,
          entries: result.data.history,
        });
        setFocusApplicationId(applicationId);
        setFlowReturnPanel('status-history');
      } catch (err) {
        setError(err instanceof Error ? err.message : t('applicationsPage.errors.loadStatusHistoryFailed'));
      }
    },
    [rankedItems, t]
  );

  useEffect(() => {
    if (!pendingStatusHistoryApplicationId.trim()) return;

    let cancelled = false;
    const openFromDeepLink = async () => {
      try {
        await openStatusHistory(pendingStatusHistoryApplicationId.trim());
      } finally {
        if (!cancelled) {
          setPendingStatusHistoryApplicationId('');
        }
      }
    };

    void openFromDeepLink();
    return () => {
      cancelled = true;
    };
  }, [openStatusHistory, pendingStatusHistoryApplicationId]);

  useEffect(() => {
    if (!pendingFeedbackApplicationId.trim()) return;

    let cancelled = false;
    const openFeedbackFromDeepLink = async () => {
      try {
        await openFeedback(pendingFeedbackApplicationId.trim());
      } finally {
        if (!cancelled) {
          setPendingFeedbackApplicationId('');
        }
      }
    };

    void openFeedbackFromDeepLink();
    return () => {
      cancelled = true;
    };
  }, [openFeedback, pendingFeedbackApplicationId]);

  useEffect(() => {
    if (!defaultOpenStatusChanges) return;
    if (statusChangesDeepLinkHandledRef.current) return;
    if (!jobId.trim() || !statusChangesActivated || isLoadingStatusChanges) return;

    statusChangesDeepLinkHandledRef.current = true;
    if (defaultApplicationId.trim()) {
      setStatusChangesFocusApplicationId(defaultApplicationId.trim());
    }
    setFlowReturnPanel('status-changes');
    const timer = window.setTimeout(() => {
      statusChangesCardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [defaultOpenStatusChanges, jobId, statusChangesActivated, isLoadingStatusChanges]);

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
          <div className="flex flex-wrap items-center gap-2">
            {isFlowContext ? (
              <Link href={flowReturnHref}>
                <Button variant="outline">{t('applicationsPage.returnToFlow')}</Button>
              </Link>
            ) : null}
            <Link href="/dashboard">
              <Button variant="outline">{t('nav.backToDashboard')}</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {isRecruiterOrAdmin ? (
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
                  if (focusApplicationId) {
                    setFocusApplicationId('');
                    setFocusOnlyMode(false);
                  }
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
              <Input
                placeholder={t('applicationsPage.recruiterView.changedByFilterPlaceholder')}
                value={rankedChangedByFilter}
                onChange={(e) => {
                  setRankedChangedByFilter(e.target.value);
                  setRankedPage(1);
                }}
                className="w-[220px]"
              />
              <div className="flex items-center gap-2 border border-black bg-white px-2 h-10">
                <span className="font-mono text-[10px] uppercase text-gray-600">
                  {t('applicationsPage.recruiterView.changedAfterLabel')}
                </span>
                <Input
                  type="date"
                  aria-label={t('applicationsPage.recruiterView.changedAfterLabel')}
                  value={rankedChangedAfter}
                  onChange={(e) => {
                    setRankedDatePreset('');
                    setRankedChangedAfter(e.target.value);
                    setRankedPage(1);
                  }}
                  className="h-8 border-0 px-1 text-xs"
                />
              </div>
              <div className="flex items-center gap-2 border border-black bg-white px-2 h-10">
                <span className="font-mono text-[10px] uppercase text-gray-600">
                  {t('applicationsPage.recruiterView.changedBeforeLabel')}
                </span>
                <Input
                  type="date"
                  aria-label={t('applicationsPage.recruiterView.changedBeforeLabel')}
                  value={rankedChangedBefore}
                  onChange={(e) => {
                    setRankedDatePreset('');
                    setRankedChangedBefore(e.target.value);
                    setRankedPage(1);
                  }}
                  className="h-8 border-0 px-1 text-xs"
                />
              </div>
              <div className="flex items-center gap-2 border border-black bg-white px-2 h-10">
                <span className="font-mono text-[10px] uppercase text-gray-600">
                  {t('applicationsPage.recruiterView.quickRangeLabel')}
                </span>
                {RANKED_DATE_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    variant="outline"
                    className={`h-8 px-2 text-[10px] ${rankedDatePreset === preset ? 'bg-blue-50 border-blue-700 text-blue-900' : ''}`}
                    onClick={() => applyRankedDatePreset(preset)}
                    disabled={isLoadingRanked}
                  >
                    {t(`applicationsPage.recruiterView.preset.${preset}`)}
                  </Button>
                ))}
              </div>
              <Button onClick={activateRanked} disabled={isLoadingRanked}>
                {isLoadingRanked ? t('common.loading') : t('applicationsPage.load')}
              </Button>
            </div>
            <div
              className={`flex flex-wrap items-center gap-2 transition-colors duration-300 ${
                isRankedSummaryAnimating ? 'bg-blue-50' : ''
              }`}
            >
              <span className="font-mono text-[10px] uppercase text-gray-600">
                {t('applicationsPage.recruiterView.activeFiltersLabel')}
              </span>
              <Button
                variant="outline"
                onClick={clearRankedSummaryFilters}
                disabled={isLoadingRanked}
              >
                {t('applicationsPage.recruiterView.clearSummaryButton')}
              </Button>
              {rankedFilterSummary.length ? (
                rankedFilterSummary.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => removeRankedFilterChip(item.id)}
                    className="font-mono text-[10px] uppercase border border-black bg-white px-2 py-1 hover:bg-[#E5E5E0]"
                    aria-label={t('applicationsPage.recruiterView.removeFilterLabel', {
                      filter: item.label,
                    })}
                  >
                    {item.label}
                  </button>
                ))
              ) : (
                <span className="font-mono text-[10px] uppercase text-gray-500">
                  {t('applicationsPage.recruiterView.activeFiltersNone')}
                </span>
              )}
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
          ) : null}

          {isCandidateOnly ? (
            <Card variant="outline" className="space-y-3">
            <CardTitle className="text-xl">{t('applicationsPage.candidateView.title')}</CardTitle>
            <CardDescription className="text-xs uppercase">
              {t('applicationsPage.candidateView.description')}
            </CardDescription>
            <div className="flex gap-2">
              <Input
                placeholder={t('applicationsPage.candidateView.candidateIdPlaceholder')}
                value={candidateId}
                readOnly
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
          ) : null}
        </div>

        {isRecruiterOrAdmin ? renderSummary() : null}

        {isRecruiterOrAdmin ? (
          <Card ref={statusChangesCardRef} variant="outline" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-2xl">{t('applicationsPage.statusChanges.title')}</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  clearStatusChangesSummaryFilters();
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
              <Button
                variant="outline"
                onClick={handleExportStatusChanges}
                disabled={isLoadingStatusChanges || isExportingStatusChanges}
              >
                {isExportingStatusChanges
                  ? t('common.loading')
                  : t('applicationsPage.statusChanges.exportButton')}
              </Button>
            </div>
          </div>
          {statusChangesFocusApplicationId.trim() ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[11px] uppercase text-blue-900">
                {statusChangesFocusedVisible
                  ? t('applicationsPage.statusChanges.focusedApplicationVisible')
                  : isSeekingFocusedStatusChanges
                    ? t('applicationsPage.statusChanges.focusedApplicationSeeking')
                    : t('applicationsPage.statusChanges.focusedApplicationNotVisible')}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setStatusChangesFocusApplicationId('');
                  if (flowReturnPanel === 'status-changes') {
                    setFlowReturnPanel('');
                  }
                }}
              >
                {t('applicationsPage.statusChanges.clearFocusedApplication')}
              </Button>
            </div>
          ) : null}
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
            {STATUS_CHANGES_PRESETS.map((preset) => (
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
          <div
            className={`flex flex-wrap items-center gap-2 transition-colors duration-300 ${
              isStatusChangesSummaryAnimating ? 'bg-blue-50' : ''
            }`}
          >
            <span className="font-mono text-[10px] uppercase text-gray-600">
              {t('applicationsPage.statusChanges.activeFiltersLabel')}
            </span>
            <Button
              variant="outline"
              onClick={clearStatusChangesSummaryFilters}
              disabled={isLoadingStatusChanges}
            >
              {t('applicationsPage.statusChanges.clearSummaryButton')}
            </Button>
            {statusChangesFilterSummary.length ? (
              statusChangesFilterSummary.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => removeStatusChangesFilterChip(item.id)}
                  className="font-mono text-[10px] uppercase border border-black bg-white px-2 py-1 hover:bg-[#E5E5E0]"
                  aria-label={t('applicationsPage.statusChanges.removeFilterLabel', {
                    filter: item.label,
                  })}
                >
                  {item.label}
                </button>
              ))
            ) : (
              <span className="font-mono text-[10px] uppercase text-gray-500">
                {t('applicationsPage.statusChanges.activeFiltersNone')}
              </span>
            )}
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
                <div
                  key={`${item.application_id}-${item.changed_at}`}
                  ref={
                    item.application_id === statusChangesFocusApplicationId
                      ? statusChangesFocusedRowRef
                      : null
                  }
                  data-status-change-focused={
                    item.application_id === statusChangesFocusApplicationId ? 'true' : 'false'
                  }
                  className={`border p-3 ${
                    item.application_id === statusChangesFocusApplicationId
                      ? 'border-blue-700 bg-blue-50 ring-1 ring-blue-300'
                      : 'border-black bg-white'
                  }`}
                >
                  {item.application_id === statusChangesFocusApplicationId ? (
                    <p className="font-mono text-[10px] uppercase text-blue-800 mb-1">
                      {t('applicationsPage.statusChanges.focusBadge')}
                    </p>
                  ) : null}
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
        ) : null}

        {error ? (
          <Card variant="outline" className="border-red-700 bg-red-50">
            <CardTitle className="text-red-700">{t('common.error')}</CardTitle>
            <CardDescription className="text-red-700">{error}</CardDescription>
          </Card>
        ) : null}

        {isRecruiterOrAdmin ? (
          <Card variant="outline" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-2xl">{t('applicationsPage.rankedCandidates.title')}</CardTitle>
            {focusApplicationId ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={focusOnlyMode ? 'default' : 'outline'}
                  disabled={!focusedRankedItem}
                  onClick={() => setFocusOnlyMode((prev) => !prev)}
                >
                  {focusOnlyMode
                    ? t('applicationsPage.rankedCandidates.focusOnlyDisable')
                    : t('applicationsPage.rankedCandidates.focusOnlyEnable')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFocusApplicationId('');
                    setFocusOnlyMode(false);
                  }}
                >
                  {t('applicationsPage.rankedCandidates.clearFocusedApplication')}
                </Button>
              </div>
            ) : null}
          </div>
          {focusApplicationId ? (
            <p className="font-mono text-[11px] uppercase text-blue-900">
              {focusedRankedItem
                ? t('applicationsPage.rankedCandidates.focusedApplication')
                : isSeekingFocusedApplication
                  ? t('applicationsPage.rankedCandidates.focusedApplicationSeeking')
                  : t('applicationsPage.rankedCandidates.focusedApplicationNotVisible')}
            </p>
          ) : null}
          {focusOnlyMode && focusedRankedItem ? (
            <p className="font-mono text-[11px] uppercase text-blue-900">
              {t('applicationsPage.rankedCandidates.focusedApplicationOnlyMode')}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 border border-black bg-[#E7EEF9] p-2">
            <label className="inline-flex items-center gap-2 font-mono text-[11px] uppercase">
              <input
                type="checkbox"
                checked={
                  Boolean(displayedRankedItems.length) &&
                  selectedRankedApplicationIds.length === displayedRankedItems.length
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedRankedApplicationIds(
                      displayedRankedItems.map((item) => item.application_id)
                    );
                  } else {
                    setSelectedRankedApplicationIds([]);
                  }
                }}
                disabled={
                  !displayedRankedItems.length ||
                  isLoadingRanked ||
                  isApplyingBulkStatus ||
                  isUndoingBulkStatus
                }
              />
              {t('applicationsPage.rankedCandidates.selectAllCurrentPage')}
            </label>
            <span className="font-mono text-[11px] uppercase text-blue-900">
              {t('applicationsPage.rankedCandidates.selectedCount', {
                count: selectedRankedApplicationIds.length,
              })}
            </span>
            <select
              className="h-10 border border-black bg-white px-2 text-xs uppercase rounded-none"
              value={bulkRankedStatus}
              onChange={(e) => setBulkRankedStatus(e.target.value as ApplicationStatus | '')}
              disabled={isApplyingBulkStatus || isUndoingBulkStatus}
            >
              <option value="">{t('applicationsPage.rankedCandidates.bulkStatusPlaceholder')}</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              onClick={handleBulkRankedStatusApply}
              disabled={
                !selectedRankedApplicationIds.length ||
                !bulkRankedStatus ||
                isApplyingBulkStatus ||
                isUndoingBulkStatus
              }
            >
              {isApplyingBulkStatus
                ? t('common.loading')
                : t('applicationsPage.rankedCandidates.applyBulkStatusButton')}
            </Button>
            <Button
              variant="outline"
              onClick={handleUndoBulkRankedStatusApply}
              disabled={!bulkRankedUndoPayload.length || isApplyingBulkStatus || isUndoingBulkStatus}
            >
              {isUndoingBulkStatus
                ? t('common.loading')
                : t('applicationsPage.rankedCandidates.undoBulkStatusButton')}
            </Button>
            {bulkRankedStatusResult ? (
              <span className="font-mono text-[11px] uppercase text-blue-900">
                {t('applicationsPage.rankedCandidates.bulkResultLine', {
                  requested: bulkRankedStatusResult.requestedCount,
                  matched: bulkRankedStatusResult.matchedCount,
                  updated: bulkRankedStatusResult.updatedCount,
                  unchanged: bulkRankedStatusResult.unchangedCount,
                  status: statusLabel(bulkRankedStatusResult.status),
                })}
              </span>
            ) : null}
            {bulkRankedUndoResult ? (
              <span className="font-mono text-[11px] uppercase text-green-700">
                {t('applicationsPage.rankedCandidates.bulkUndoResultLine', {
                  reverted: bulkRankedUndoResult.revertedCount,
                })}
              </span>
            ) : null}
          </div>
          <div className="space-y-2">
            {displayedRankedItems.map((item) => (
              <div
                key={item.application_id}
                ref={item.application_id === focusApplicationId ? focusedCardRef : null}
                data-focused={item.application_id === focusApplicationId ? 'true' : 'false'}
                className={`border p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between ${
                  item.application_id === focusApplicationId
                    ? 'border-blue-700 bg-blue-50 ring-2 ring-blue-300'
                    : 'border-black bg-white'
                }`}
              >
                <div>
                  {item.application_id === focusApplicationId ? (
                    <p className="font-mono text-[10px] uppercase text-blue-800 mb-1">
                      {t('applicationsPage.rankedCandidates.focusBadge')}
                    </p>
                  ) : null}
                  <label className="inline-flex items-center gap-2 font-mono text-[11px] uppercase text-gray-600 mb-2">
                    <input
                      type="checkbox"
                      checked={selectedRankedApplicationIds.includes(item.application_id)}
                      onChange={(e) => {
                        setSelectedRankedApplicationIds((prev) => {
                          if (e.target.checked) {
                            if (prev.includes(item.application_id)) return prev;
                            return [...prev, item.application_id];
                          }
                          return prev.filter((id) => id !== item.application_id);
                        });
                      }}
                      disabled={isApplyingBulkStatus || isUndoingBulkStatus}
                    />
                    {t('applicationsPage.rankedCandidates.selectForBulk')}
                  </label>
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
                    onClick={() => openStatusChanges(item.application_id)}
                  >
                    {t('applicationsPage.rankedCandidates.statusChangesButton')}
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

            {!displayedRankedItems.length ? (
              <p className="font-mono text-xs uppercase text-gray-500">
                {t('applicationsPage.rankedCandidates.empty')}
              </p>
            ) : null}
          </div>
          </Card>
        ) : null}

        {isCandidateOnly ? (
          <Card variant="outline" className="space-y-4">
          <CardTitle className="text-2xl">{t('applicationsPage.candidateHistory.title')}</CardTitle>
          {candidateFocusEnabled && focusApplicationId.trim() ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[11px] uppercase text-blue-900">
                {focusedHistoryItem
                  ? t('applicationsPage.candidateHistory.focusedApplicationVisible')
                  : isSeekingFocusedHistoryItem
                    ? t('applicationsPage.candidateHistory.focusedApplicationSeeking')
                    : t('applicationsPage.candidateHistory.focusedApplicationNotVisible')}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setCandidateFocusEnabled(false);
                  setFocusApplicationId('');
                }}
              >
                {t('applicationsPage.candidateHistory.clearFocusedApplication')}
              </Button>
            </div>
          ) : null}
          <div className="space-y-2">
            {historyItems.map((item) => (
              <div
                key={item.application_id}
                ref={
                  candidateFocusEnabled && item.application_id === focusApplicationId
                    ? candidateFocusedHistoryRef
                    : null
                }
                data-candidate-history-focused={
                  candidateFocusEnabled && item.application_id === focusApplicationId ? 'true' : 'false'
                }
                className={`border p-3 ${
                  candidateFocusEnabled && item.application_id === focusApplicationId
                    ? 'border-blue-700 bg-blue-50 ring-1 ring-blue-300'
                    : 'border-black bg-white'
                }`}
              >
                {candidateFocusEnabled && item.application_id === focusApplicationId ? (
                  <p className="font-mono text-[10px] uppercase text-blue-800 mb-1">
                    {t('applicationsPage.candidateHistory.focusBadge')}
                  </p>
                ) : null}
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
        ) : null}

        {feedback ? (
          <Card variant="outline" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-2xl">{t('applicationsPage.feedback.title')}</CardTitle>
              <Button
                variant="outline"
                onClick={() => {
                  setFeedback(null);
                  if (flowReturnPanel === 'feedback') {
                    setFlowReturnPanel('');
                  }
                }}
              >
                {t('common.close')}
              </Button>
            </div>
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
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedStatusHistory(null);
                  if (flowReturnPanel === 'status-history') {
                    setFlowReturnPanel('');
                  }
                }}
              >
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
