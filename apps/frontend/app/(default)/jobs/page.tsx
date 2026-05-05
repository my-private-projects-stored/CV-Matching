'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from '@/lib/i18n';
import {
  closeJob,
  deleteJob,
  fetchJobs,
  reopenJob,
  updateJob,
  type JobCategory,
  type JobItem,
  type JobStatus,
} from '@/lib/api/jobs';
import { fetchCompanyProfileConfig, type CompanyProfileConfig } from '@/lib/api/config';
import { createApplication } from '@/lib/api/applications';
import { fetchResumeList } from '@/lib/api/resume';
import { useAuth } from '@/lib/context/auth-context';
import {
  buildPathWithQuery,
  createSearchParams,
  sanitizeApplicationsReturnSnapshot,
  sanitizeJobsReturnSnapshot,
  setOrDeleteQueryParam,
} from '@/lib/utils/query-params';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type JobAction = 'toggle-status' | 'delete';

type JobEditForm = {
  title: string;
  description: string;
  requirements: string;
  benefits: string;
  applicationDeadline: string;
  category: JobCategory;
  location: string;
  experienceLevel: string;
};

type JobHistoryEntry = {
  changedAt: string;
  changedFields: string[];
  changes?: Array<{
    field: string;
    before: string | null;
    after: string | null;
  }>;
  summary: string;
};

type Filters = {
  search: string;
  category: JobCategory | '';
  status: JobStatus | '';
  location: string;
};

type FlowPrefillJobPayload = {
  jobId: string;
  jobDescription: string;
  source: 'jobs';
  createdAt: string;
};

const FLOW_PREFILL_JOB_STORAGE_KEY = 'flow_prefill_job_v1';

const DEFAULT_FILTERS: Filters = {
  search: '',
  category: '',
  status: 'active',
  location: '',
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function parseJobStatusFilter(value: string | null): JobStatus | '' | undefined {
  if (value === null) return undefined;
  if (value === '' || value === 'all') return '';
  if (value === 'active' || value === 'closed') return value;
  return undefined;
}

function parseJobCategoryFilter(value: string | null): JobCategory | '' | undefined {
  if (value === null) return undefined;
  if (value === '') return '';
  if (value === 'IT' || value === 'Accounting' || value === 'Marketing') return value;
  return undefined;
}

function parsePositivePage(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function normalizeCompanyValue(value?: string | null): string {
  return String(value || '').trim();
}

function formatWebsiteDisplay(value: string): string {
  return value.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

export default function JobsPage() {
  const { t } = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const defaultStatusFilter = parseJobStatusFilter(searchParams.get('status'));
  const defaultCategoryFilter = parseJobCategoryFilter(searchParams.get('category'));
  const defaultSearchFilter = (searchParams.get('search') || '').trim();
  const defaultLocationFilter = (searchParams.get('location') || '').trim();
  const defaultFocusJobId = (searchParams.get('focus_job_id') || '').trim();
  const defaultSource = (searchParams.get('source') || '').trim();
  const applicationsReturnQuery = (searchParams.get('applications_return_query') || '').trim();
  const defaultPage = parsePositivePage(searchParams.get('page')) || 1;
  const [filters, setFilters] = useState<Filters>({
    search: defaultSearchFilter,
    category: defaultCategoryFilter ?? DEFAULT_FILTERS.category,
    status: defaultStatusFilter ?? DEFAULT_FILTERS.status,
    location: defaultLocationFilter,
  });
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileConfig | null>(null);
  const [page, setPage] = useState(defaultPage);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSeekingFocusedJob, setIsSeekingFocusedJob] = useState(false);
  const [focusJobId, setFocusJobId] = useState(defaultFocusJobId);
  const [masterResumeId, setMasterResumeId] = useState<string | null>(null);
  const [masterCandidateId, setMasterCandidateId] = useState<string | null>(null);
  const [isApplyingJobId, setIsApplyingJobId] = useState<string | null>(null);
  const [jobActionState, setJobActionState] = useState<{ jobId: string; action: JobAction } | null>(
    null
  );
  const [applyMessage, setApplyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [managementMessage, setManagementMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [isSavingJobEdit, setIsSavingJobEdit] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [historyDialogTitle, setHistoryDialogTitle] = useState('');
  const [historyEntries, setHistoryEntries] = useState<JobHistoryEntry[]>([]);
  const [historyFieldFilter, setHistoryFieldFilter] = useState('all');
  const [editForm, setEditForm] = useState<JobEditForm>({
    title: '',
    description: '',
    requirements: '',
    benefits: '',
    applicationDeadline: '',
    category: 'IT',
    location: '',
    experienceLevel: '',
  });
  const [error, setError] = useState<string | null>(null);
  const isRecruiterOrAdmin = user?.role === 'recruiter' || user?.role === 'admin';
  const focusedJobCardRef = useRef<HTMLDivElement | null>(null);
  const focusedJobSeekAttemptedKeyRef = useRef('');
  const focusedJobSeekRunIdRef = useRef(0);

  const activeFilters = useMemo(() => ({ ...filters, page, limit: 12 }), [filters, page]);
  const focusedJobVisible = useMemo(() => {
    if (!focusJobId.trim()) return false;
    return jobs.some((item) => item._id === focusJobId.trim());
  }, [focusJobId, jobs]);
  const focusedJobSeekKey = useMemo(
    () =>
      JSON.stringify({
        focusJobId: focusJobId.trim(),
        search: filters.search.trim(),
        category: filters.category,
        status: filters.status,
        location: filters.location.trim(),
      }),
    [focusJobId, filters.search, filters.category, filters.status, filters.location]
  );
  const canReturnToApplications = defaultSource === 'applications';
  const canReturnToFlow = defaultSource === 'flow';
  const applicationsReturnHref = useMemo(() => {
    if (!applicationsReturnQuery) {
      return '/applications';
    }

    const params = sanitizeApplicationsReturnSnapshot(applicationsReturnQuery);
    return buildPathWithQuery('/applications', params);
  }, [applicationsReturnQuery]);
  const flowReturnHref = useMemo(() => {
    const params = createSearchParams();
    const snapshot = sanitizeJobsReturnSnapshot(searchParams, {
      stripApplicationsReturn: false,
    });

    if (focusJobId.trim()) {
      params.set('flow_return_job_id', focusJobId.trim());
    }

    const snapshotQuery = snapshot.toString();
    if (snapshotQuery) {
      params.set('jobs_return_query', snapshotQuery);
    }

    return buildPathWithQuery('/flow', params);
  }, [searchParams, focusJobId]);
  const buildApplicationsJobHref = useCallback(
    (nextJobId: string) => {
      const params = canReturnToApplications
        ? sanitizeApplicationsReturnSnapshot(applicationsReturnQuery, {
            stripCandidateIdentity: true,
            stripApplicationIdentity: true,
          })
        : createSearchParams();

      const jobsSnapshot = sanitizeJobsReturnSnapshot(searchParams);
      if (jobsSnapshot.toString()) {
        if (!(jobsSnapshot.get('status') || '').trim()) {
          jobsSnapshot.set('status', 'all');
        }
        const snapshotSource = (jobsSnapshot.get('source') || '').trim();
        if (!snapshotSource || (snapshotSource !== 'applications' && snapshotSource !== 'flow')) {
          jobsSnapshot.set('source', 'applications');
        }
        params.set('jobs_return_query', jobsSnapshot.toString());
      }

      setOrDeleteQueryParam(params, 'job_id', nextJobId.trim());
      return buildPathWithQuery('/applications', params);
    },
    [canReturnToApplications, applicationsReturnQuery, searchParams]
  );
  const focusedJobItem = useMemo(() => {
    if (!focusJobId.trim()) return null;
    return jobs.find((item) => item._id === focusJobId.trim()) || null;
  }, [focusJobId, jobs]);

  useEffect(() => {
    let active = true;

    async function resolveMasterResume() {
      const fromStorage = localStorage.getItem('master_resume_id');
      try {
        const resumes = await fetchResumeList(true);
        const master = fromStorage
          ? resumes.find((item) => item.resume_id === fromStorage) || resumes.find((item) => item.is_master)
          : resumes.find((item) => item.is_master);
        if (!active || !master?.resume_id) return;

        setMasterResumeId(master.resume_id);
        setMasterCandidateId(master.candidate_id || null);
        localStorage.setItem('master_resume_id', master.resume_id);
      } catch {
        if (active) {
          setMasterResumeId(fromStorage || null);
          setMasterCandidateId(null);
        }
      }
    }

    void resolveMasterResume();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCompanyProfile() {
      try {
        const profile = await fetchCompanyProfileConfig();
        if (active) {
          setCompanyProfile(profile);
        }
      } catch {
        if (active) {
          setCompanyProfile(null);
        }
      }
    }

    void loadCompanyProfile();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchJobs(activeFilters);
        if (!active) return;
        setJobs(response.data);
        setTotalPages(response.pagination.totalPages);
        setTotal(response.pagination.total);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : t('jobsPage.failedLoad'));
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [activeFilters]);

  useEffect(() => {
    const next = createSearchParams(searchParams.toString());

    setOrDeleteQueryParam(next, 'search', filters.search.trim());
    setOrDeleteQueryParam(next, 'category', filters.category);

    const statusQueryValue =
      filters.status === DEFAULT_FILTERS.status ? '' : filters.status === '' ? 'all' : filters.status;
    setOrDeleteQueryParam(next, 'status', statusQueryValue);
    setOrDeleteQueryParam(next, 'location', filters.location.trim());
    setOrDeleteQueryParam(next, 'focus_job_id', focusJobId.trim());

    if (page > 1) {
      next.set('page', String(page));
    } else {
      next.delete('page');
    }

    const nextSource = (next.get('source') || '').trim();
    if (nextSource && nextSource !== 'applications') {
      next.delete('applications_return_query');
    }

    if (!focusJobId.trim() && nextSource === 'applications') {
      next.delete('source');
      next.delete('applications_return_query');
    }

    const nextQuery = next.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) {
      return;
    }

    router.replace(buildPathWithQuery(pathname, nextQuery), { scroll: false });
  }, [
    router,
    pathname,
    searchParams,
    filters.search,
    filters.category,
    filters.status,
    filters.location,
    page,
    focusJobId,
  ]);

  useEffect(() => {
    if (!focusJobId.trim() || !focusedJobVisible) return;

    const timer = window.setTimeout(() => {
      focusedJobCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [focusJobId, focusedJobVisible, page]);

  useEffect(() => {
    if (!focusJobId.trim()) {
      focusedJobSeekRunIdRef.current += 1;
      focusedJobSeekAttemptedKeyRef.current = '';
      setIsSeekingFocusedJob(false);
      return;
    }

    if (isLoading) return;
    if (focusedJobVisible) return;
    if (totalPages <= 1) return;
    if (focusedJobSeekAttemptedKeyRef.current === focusedJobSeekKey) return;

    focusedJobSeekAttemptedKeyRef.current = focusedJobSeekKey;
    const runId = focusedJobSeekRunIdRef.current + 1;
    focusedJobSeekRunIdRef.current = runId;

    let cancelled = false;
    const seekFocusedJob = async () => {
      if (cancelled || focusedJobSeekRunIdRef.current !== runId) return;
      setIsSeekingFocusedJob(true);

      try {
        for (let nextPage = 1; nextPage <= totalPages; nextPage += 1) {
          if (nextPage === page) continue;

          const response = await fetchJobs({
            search: filters.search,
            category: filters.category,
            status: filters.status,
            location: filters.location,
            page: nextPage,
            limit: 12,
          });

          if (cancelled || focusedJobSeekRunIdRef.current !== runId) return;

          const match = response.data.some((job) => job._id === focusJobId.trim());
          if (match) {
            setPage(nextPage);
            return;
          }
        }
      } catch {
        // Keep current page and focus hint when background seek fails.
      } finally {
        if (!cancelled && focusedJobSeekRunIdRef.current === runId) {
          setIsSeekingFocusedJob(false);
        }
      }
    };

    void seekFocusedJob();

    return () => {
      cancelled = true;
    };
  }, [
    focusJobId,
    focusedJobVisible,
    focusedJobSeekKey,
    isLoading,
    page,
    totalPages,
    filters.search,
    filters.category,
    filters.status,
    filters.location,
  ]);

  async function handleApply(jobId: string) {
    if (!masterResumeId) {
      setApplyMessage({
        type: 'error',
        text: t('jobsPage.masterRequired'),
      });
      return;
    }

    setApplyMessage(null);
    setIsApplyingJobId(jobId);

    try {
      const created = await createApplication({
        job_id: jobId,
        resume_id: masterResumeId,
      });

      setApplyMessage({ type: 'success', text: t('jobsPage.submittedRedirecting') });

      const params = new URLSearchParams();
      const createdApplicationId = created.data.application_id || '';

      if (masterCandidateId) {
        params.set('candidate_id', masterCandidateId);
        if (createdApplicationId) {
          params.set('application_id', createdApplicationId);
          params.set('candidate_focus', '1');
        }
      } else {
        params.set('job_id', jobId);
        if (createdApplicationId) {
          params.set('application_id', createdApplicationId);
        }
      }

      const jobsSnapshot = sanitizeJobsReturnSnapshot(searchParams);
      if (jobsSnapshot.toString()) {
        if (!(jobsSnapshot.get('status') || '').trim()) {
          jobsSnapshot.set('status', 'all');
        }
        const snapshotSource = (jobsSnapshot.get('source') || '').trim();
        if (!snapshotSource || (snapshotSource !== 'applications' && snapshotSource !== 'flow')) {
          jobsSnapshot.set('source', 'applications');
        }
        params.set('jobs_return_query', jobsSnapshot.toString());
      }

      const target = `/applications?${params.toString()}`;
      setTimeout(() => {
        router.push(target);
      }, 600);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('jobsPage.failedSubmit');
      if (message.includes('409')) {
        setApplyMessage({
          type: 'success',
          text: t('jobsPage.duplicateRedirecting'),
        });

        const params = createSearchParams();
        if (masterCandidateId) {
          params.set('candidate_id', masterCandidateId);
        } else {
          params.set('job_id', jobId);
        }

        const jobsSnapshot = sanitizeJobsReturnSnapshot(searchParams);
        if (jobsSnapshot.toString()) {
          if (!(jobsSnapshot.get('status') || '').trim()) {
            jobsSnapshot.set('status', 'all');
          }
          const snapshotSource = (jobsSnapshot.get('source') || '').trim();
          if (!snapshotSource || (snapshotSource !== 'applications' && snapshotSource !== 'flow')) {
            jobsSnapshot.set('source', 'applications');
          }
          params.set('jobs_return_query', jobsSnapshot.toString());
        }

        const target = buildPathWithQuery('/applications', params);
        setTimeout(() => {
          router.push(target);
        }, 600);
      } else {
        setApplyMessage({ type: 'error', text: message });
      }
    } finally {
      setIsApplyingJobId(null);
    }
  }

  function handleTailorAndApply(job: JobItem, options?: { fromFocusedBanner?: boolean }) {
    if (!masterResumeId) {
      setApplyMessage({
        type: 'error',
        text: t('jobsPage.masterRequired'),
      });
      return;
    }

    const payload: FlowPrefillJobPayload = {
      jobId: job._id,
      jobDescription: job.description || '',
      source: 'jobs',
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(FLOW_PREFILL_JOB_STORAGE_KEY, JSON.stringify(payload));

    const flowParams = createSearchParams();
    flowParams.set('prefill_job', '1');
    if (options?.fromFocusedBanner) {
      flowParams.set('focused_job', '1');
    }

    const jobsReturnSnapshot = sanitizeJobsReturnSnapshot(searchParams, {
      stripApplicationsReturn: false,
    });
    if (jobsReturnSnapshot.toString()) {
      const snapshotSource = (jobsReturnSnapshot.get('source') || '').trim();
      if (!snapshotSource || (snapshotSource !== 'applications' && snapshotSource !== 'flow')) {
        jobsReturnSnapshot.set('source', 'flow');
      }
      flowParams.set('jobs_return_query', jobsReturnSnapshot.toString());
    }

    router.push(buildPathWithQuery('/flow', flowParams));
  }

  function updateFilters(patch: Partial<Filters>) {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  async function refreshCurrentPage() {
    const response = await fetchJobs(activeFilters);
    setJobs(response.data);
    setTotalPages(response.pagination.totalPages);
    setTotal(response.pagination.total);
  }

  async function handleToggleJobStatus(job: JobItem) {
    setManagementMessage(null);
    setJobActionState({ jobId: job._id, action: 'toggle-status' });

    try {
      if (job.status === 'active') {
        await closeJob(job._id);
        setManagementMessage({ type: 'success', text: t('jobsPage.jobClosed') });
      } else {
        await reopenJob(job._id);
        setManagementMessage({ type: 'success', text: t('jobsPage.jobReopened') });
      }

      await refreshCurrentPage();
    } catch (err) {
      setManagementMessage({
        type: 'error',
        text: err instanceof Error ? err.message : t('jobsPage.failedUpdateJob'),
      });
    } finally {
      setJobActionState(null);
    }
  }

  async function handleDeleteJob(jobId: string) {
    setManagementMessage(null);
    setJobActionState({ jobId, action: 'delete' });

    try {
      await deleteJob(jobId);
      setManagementMessage({ type: 'success', text: t('jobsPage.jobDeleted') });

      const response = await fetchJobs(activeFilters);
      const shouldGoPrevPage = page > 1 && response.data.length === 0;

      if (shouldGoPrevPage) {
        setPage((prev) => Math.max(1, prev - 1));
      } else {
        setJobs(response.data);
        setTotalPages(response.pagination.totalPages);
        setTotal(response.pagination.total);
      }
    } catch (err) {
      setManagementMessage({
        type: 'error',
        text: err instanceof Error ? err.message : t('jobsPage.failedDeleteJob'),
      });
    } finally {
      setJobActionState(null);
    }
  }

  function openEditDialog(job: JobItem) {
    setManagementMessage(null);
    setEditingJobId(job._id);
    setEditForm({
      title: job.title || '',
      description: job.description || '',
      requirements: job.requirements || '',
      benefits: job.benefits || '',
      applicationDeadline: toDateInputValue(job.applicationDeadline),
      category: job.category,
      location: job.location || '',
      experienceLevel: job.experienceLevel || '',
    });
    setIsEditDialogOpen(true);
  }

  function closeEditDialog(force = false) {
    if (isSavingJobEdit && !force) return;
    setIsEditDialogOpen(false);
    setEditingJobId(null);
  }

  function updateEditField<K extends keyof JobEditForm>(field: K, value: JobEditForm[K]) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }

  function openHistoryDialog(job: JobItem) {
    setHistoryDialogTitle(job.title || t('jobsPage.historyDialogTitle'));
    const entries = (job.importantChangeHistory || []).map((entry) => ({
      changedAt: entry.changedAt,
      changedFields: entry.changedFields || [],
      changes: entry.changes || [],
      summary: entry.summary || '',
    }));
    setHistoryEntries(entries);
    setHistoryFieldFilter('all');
    setIsHistoryDialogOpen(true);
  }

  const historyFieldOptions = useMemo(() => {
    const fields = new Set<string>();
    for (const entry of historyEntries) {
      for (const field of entry.changedFields || []) {
        if (field) {
          fields.add(field);
        }
      }
    }
    return Array.from(fields).sort();
  }, [historyEntries]);

  const filteredHistoryEntries = useMemo(() => {
    const sorted = [...historyEntries].sort(
      (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
    );
    if (historyFieldFilter === 'all') {
      return sorted;
    }
    return sorted.filter((entry) => entry.changedFields.includes(historyFieldFilter));
  }, [historyEntries, historyFieldFilter]);

  const companyName = normalizeCompanyValue(companyProfile?.company_name);
  const companyOverview = normalizeCompanyValue(companyProfile?.overview);
  const companyIndustry = normalizeCompanyValue(companyProfile?.industry);
  const companySize = normalizeCompanyValue(companyProfile?.company_size);
  const companyAddress = normalizeCompanyValue(companyProfile?.address);
  const companyWebsite = normalizeCompanyValue(companyProfile?.website);
  const companyLogoUrl = normalizeCompanyValue(companyProfile?.brand_logo_url);
  const brandPrimaryColor = normalizeCompanyValue(companyProfile?.brand_primary_color) || '#1D4ED8';
  const showCompanyProfile = Boolean(
    companyName ||
      companyOverview ||
      companyIndustry ||
      companySize ||
      companyAddress ||
      companyWebsite ||
      companyLogoUrl
  );
  const companyMetaItems = [
    { label: t('jobsPage.companyProfileIndustry'), value: companyIndustry },
    { label: t('jobsPage.companyProfileSize'), value: companySize },
    { label: t('jobsPage.companyProfileAddress'), value: companyAddress },
  ].filter((item) => item.value);

  async function handleSaveJobEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingJobId) return;

    setIsSavingJobEdit(true);
    setManagementMessage(null);

    try {
      await updateJob(editingJobId, {
        title: editForm.title,
        description: editForm.description,
        requirements: editForm.requirements,
        benefits: editForm.benefits,
        applicationDeadline: editForm.applicationDeadline
          ? new Date(`${editForm.applicationDeadline}T00:00:00.000Z`).toISOString()
          : null,
        category: editForm.category,
        location: editForm.location,
        experienceLevel: editForm.experienceLevel,
      });

      setManagementMessage({ type: 'success', text: t('jobsPage.jobUpdated') });
      closeEditDialog(true);
      await refreshCurrentPage();
    } catch (err) {
      setManagementMessage({
        type: 'error',
        text: err instanceof Error ? err.message : t('jobsPage.failedUpdateJob'),
      });
    } finally {
      setIsSavingJobEdit(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F0F0E8] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black pb-4">
          <div>
            <h1 className="font-serif text-4xl uppercase tracking-tight">{t('jobsPage.title')}</h1>
            <p className="font-mono text-xs uppercase text-blue-700">{t('jobsPage.subtitle')}</p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline">{t('nav.backToDashboard')}</Button>
          </Link>
        </div>

        {showCompanyProfile ? (
          <Card variant="outline" noPadding className="border-2 bg-white">
            <div style={{ backgroundColor: brandPrimaryColor }} className="h-1 w-full" />
            <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between">
              <div className="flex flex-1 items-start gap-4">
                {companyLogoUrl ? (
                  <div className="h-14 w-14 shrink-0 border border-black bg-white p-1">
                    <img
                      src={companyLogoUrl}
                      alt={`${companyName || t('jobsPage.companyProfileFallbackName')} logo`}
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : null}
                <div className="space-y-1">
                  <p className="font-mono text-[10px] uppercase text-gray-600">
                    {t('jobsPage.companyProfileLabel')}
                  </p>
                  <h2 className="font-serif text-2xl">
                    {companyName || t('jobsPage.companyProfileFallbackName')}
                  </h2>
                  {companyOverview ? (
                    <p className="text-sm text-gray-700">{companyOverview}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col gap-2 text-xs font-mono uppercase text-gray-600">
                {companyMetaItems.map((item) => (
                  <span key={item.label}>
                    {item.label}: {item.value}
                  </span>
                ))}
                {companyWebsite ? (
                  <a
                    href={companyWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline"
                  >
                    {t('jobsPage.companyProfileWebsite')}: {formatWebsiteDisplay(companyWebsite)}
                  </a>
                ) : null}
              </div>
            </div>
          </Card>
        ) : null}

        <Card variant="outline" className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input
              placeholder={t('common.search')}
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
            />

            <select
              className="h-10 border border-black bg-transparent px-3 text-sm rounded-none"
              value={filters.category}
              onChange={(e) => updateFilters({ category: e.target.value as JobCategory | '' })}
            >
              <option value="">{t('jobsPage.allCategories')}</option>
              <option value="IT">IT</option>
              <option value="Accounting">Accounting</option>
              <option value="Marketing">Marketing</option>
            </select>

            <select
              className="h-10 border border-black bg-transparent px-3 text-sm rounded-none"
              value={filters.status}
              onChange={(e) => updateFilters({ status: e.target.value as JobStatus | '' })}
            >
              <option value="">{t('jobsPage.allStatus')}</option>
              <option value="active">{t('jobsPage.status.active')}</option>
              <option value="closed">{t('jobsPage.status.closed')}</option>
            </select>

            <Input
              placeholder={t('jobsPage.locationPlaceholder')}
              value={filters.location}
              onChange={(e) => updateFilters({ location: e.target.value })}
            />
          </div>
        </Card>

        <div className="flex items-center justify-between font-mono text-xs uppercase text-gray-700">
          <span>{isLoading ? t('common.loading') : t('jobsPage.totalJobs', { count: total })}</span>
          <Button
            variant="ghost"
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              setPage(1);
            }}
          >
            {t('common.reset')}
          </Button>
        </div>

        {error ? (
          <Card variant="outline" className="border-red-700 bg-red-50">
            <CardTitle className="text-red-700">{t('common.error')}</CardTitle>
            <CardDescription className="text-red-700">{error}</CardDescription>
          </Card>
        ) : null}

        {applyMessage ? (
          <Card
            variant="outline"
            className={
              applyMessage.type === 'success'
                ? 'border-green-700 bg-green-50'
                : 'border-red-700 bg-red-50'
            }
          >
            <CardDescription
              className={applyMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}
            >
              {applyMessage.text}
            </CardDescription>
          </Card>
        ) : null}

        {managementMessage ? (
          <Card
            variant="outline"
            className={
              managementMessage.type === 'success'
                ? 'border-green-700 bg-green-50'
                : 'border-red-700 bg-red-50'
            }
          >
            <CardDescription
              className={managementMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}
            >
              {managementMessage.text}
            </CardDescription>
          </Card>
        ) : null}

        {focusJobId ? (
          <Card variant="outline" className="border-blue-700 bg-blue-50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardDescription className="text-blue-800">
                {focusedJobVisible
                  ? t('jobsPage.focusedJobVisible')
                  : isSeekingFocusedJob
                    ? t('jobsPage.focusedJobSeeking')
                    : t('jobsPage.focusedJobNotVisible')}
              </CardDescription>
              <div className="flex flex-wrap gap-2">
                {canReturnToApplications ? (
                  <Button variant="outline" size="sm" onClick={() => router.push(applicationsReturnHref)}>
                    {t('jobsPage.backToApplications')}
                  </Button>
                ) : null}
                {canReturnToFlow ? (
                  <Button variant="outline" size="sm" onClick={() => router.push(flowReturnHref)}>
                    {t('applicationsPage.returnToFlow')}
                  </Button>
                ) : null}
                {focusedJobItem ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTailorAndApply(focusedJobItem, { fromFocusedBanner: true })}
                  >
                    {t('jobsPage.openFocusedInFlow')}
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" onClick={() => setFocusJobId('')}>
                  {t('jobsPage.clearFocusedJob')}
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => {
            const isToggling =
              jobActionState?.jobId === job._id && jobActionState.action === 'toggle-status';
            const isDeleting = jobActionState?.jobId === job._id && jobActionState.action === 'delete';
            const isManaging = isToggling || isDeleting;
            const disableCardActions = isManaging || isApplyingJobId === job._id || isSavingJobEdit;

            return (
              <div
                key={job._id}
                ref={job._id === focusJobId ? focusedJobCardRef : null}
                data-jobs-focused={job._id === focusJobId ? 'true' : 'false'}
              >
              <Card
                variant="interactive"
                className={`min-h-[260px] ${
                  job._id === focusJobId ? 'border-blue-700 bg-blue-50 ring-1 ring-blue-300' : ''
                }`}
              >
                <div className="space-y-3">
                  {job._id === focusJobId ? (
                    <p className="font-mono text-[10px] uppercase text-blue-800">
                      {t('jobsPage.focusBadge')}
                    </p>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase text-blue-700">{job.category}</span>
                    <span className="font-mono text-xs uppercase text-gray-600">{job.status}</span>
                  </div>

                  <CardTitle className="text-2xl leading-tight">{job.title}</CardTitle>
                  <CardDescription className="text-xs uppercase text-gray-600">
                    {job.location} | {job.experienceLevel}
                  </CardDescription>

                  <p className="font-mono text-[11px] uppercase text-green-700">
                    {t('jobsPage.applicants', { count: job.applications_count ?? 0 })}
                  </p>

                  <p className="line-clamp-4 text-sm text-gray-800">{job.description}</p>

                  {job.applicationDeadline ? (
                    <p className="font-mono text-[11px] uppercase text-orange-700">
                      {t('jobsPage.deadlineLabel')}: {formatDate(job.applicationDeadline)}
                    </p>
                  ) : null}

                  {job.importantChangeHistory?.length ? (
                    <p className="font-mono text-[11px] uppercase text-gray-600">
                      {t('jobsPage.lastChangeLabel', {
                        date: formatDate(
                          job.importantChangeHistory[job.importantChangeHistory.length - 1]!.changedAt
                        ),
                      })}
                    </p>
                  ) : null}

                  <p className="font-mono text-[11px] uppercase text-gray-500">
                    {t('jobsPage.updated', { date: formatDate(job.updatedAt) })}
                  </p>

                  {isRecruiterOrAdmin ? (
                    <Link
                      href={buildApplicationsJobHref(job._id)}
                      className="inline-block font-mono text-[11px] uppercase text-blue-700 hover:underline"
                    >
                      {t('jobsPage.viewRankedCandidates')}
                    </Link>
                  ) : null}

                  {isRecruiterOrAdmin ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={disableCardActions || !job.importantChangeHistory?.length}
                        onClick={() => openHistoryDialog(job)}
                      >
                        {t('jobsPage.viewHistory')}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={disableCardActions}
                        onClick={() => openEditDialog(job)}
                      >
                        {t('jobsPage.editJob')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={disableCardActions}
                        onClick={() => void handleToggleJobStatus(job)}
                      >
                        {isToggling
                          ? t('jobsPage.updatingJob')
                          : job.status === 'active'
                            ? t('jobsPage.closeJob')
                            : t('jobsPage.reopenJob')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={disableCardActions}
                        onClick={() => void handleDeleteJob(job._id)}
                      >
                        {isDeleting ? t('jobsPage.deletingJob') : t('jobsPage.deleteJob')}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={disableCardActions || job.status === 'closed'}
                        onClick={() => handleTailorAndApply(job)}
                      >
                        {t('jobsPage.tailorAndApply')}
                      </Button>
                      <Button
                        variant="success"
                        disabled={isApplyingJobId === job._id || disableCardActions || job.status === 'closed'}
                        onClick={() => handleApply(job._id)}
                      >
                        {job.status === 'closed'
                          ? t('jobsPage.closedUnavailable')
                          : isApplyingJobId === job._id
                            ? t('jobsPage.applying')
                            : t('jobsPage.applyWithMaster')}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
              </div>
            );
          })}
        </div>

        {!isLoading && jobs.length === 0 && !error ? (
          <Card variant="outline">
            <CardTitle className="text-2xl">{t('jobsPage.noJobsTitle')}</CardTitle>
            <CardDescription>{t('jobsPage.noJobsDescription')}</CardDescription>
          </Card>
        ) : null}

        <Dialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeEditDialog();
              return;
            }
            setIsEditDialogOpen(true);
          }}
        >
          <DialogContent className="max-w-3xl p-6">
            <DialogHeader>
              <DialogTitle>{t('jobsPage.editDialogTitle')}</DialogTitle>
              <DialogDescription>{t('jobsPage.editDialogDescription')}</DialogDescription>
            </DialogHeader>

            <form className="mt-4 space-y-4" onSubmit={handleSaveJobEdit}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="job-edit-title">{t('jobsPage.titleLabel')}</Label>
                  <Input
                    id="job-edit-title"
                    value={editForm.title}
                    onChange={(e) => updateEditField('title', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="job-edit-category">{t('jobsPage.categoryLabel')}</Label>
                  <select
                    id="job-edit-category"
                    className="h-10 w-full border border-black bg-transparent px-3 text-sm rounded-none"
                    value={editForm.category}
                    onChange={(e) => updateEditField('category', e.target.value as JobCategory)}
                  >
                    <option value="IT">IT</option>
                    <option value="Accounting">Accounting</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="job-edit-location">{t('jobsPage.locationLabel')}</Label>
                  <Input
                    id="job-edit-location"
                    value={editForm.location}
                    onChange={(e) => updateEditField('location', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="job-edit-experience">{t('jobsPage.experienceLabel')}</Label>
                  <Input
                    id="job-edit-experience"
                    value={editForm.experienceLevel}
                    onChange={(e) => updateEditField('experienceLevel', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="job-edit-description">{t('jobsPage.descriptionLabel')}</Label>
                  <Textarea
                    id="job-edit-description"
                    value={editForm.description}
                    onChange={(e) => updateEditField('description', e.target.value)}
                    className="min-h-[120px]"
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="job-edit-requirements">{t('jobsPage.requirementsLabel')}</Label>
                  <Textarea
                    id="job-edit-requirements"
                    value={editForm.requirements}
                    onChange={(e) => updateEditField('requirements', e.target.value)}
                    className="min-h-[120px]"
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="job-edit-benefits">{t('jobsPage.benefitsLabel')}</Label>
                  <Textarea
                    id="job-edit-benefits"
                    value={editForm.benefits}
                    onChange={(e) => updateEditField('benefits', e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="job-edit-deadline">{t('jobsPage.applicationDeadlineLabel')}</Label>
                  <Input
                    id="job-edit-deadline"
                    type="date"
                    value={editForm.applicationDeadline}
                    onChange={(e) => updateEditField('applicationDeadline', e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => closeEditDialog()}
                  disabled={isSavingJobEdit}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isSavingJobEdit}>
                  {isSavingJobEdit ? t('jobsPage.savingJobChanges') : t('jobsPage.saveJobChanges')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
          <DialogContent className="max-w-2xl p-6">
            <DialogHeader>
              <DialogTitle>{t('jobsPage.historyDialogTitle')}</DialogTitle>
              <DialogDescription>
                {t('jobsPage.historyDialogDescription', { title: historyDialogTitle })}
              </DialogDescription>
            </DialogHeader>

            {historyEntries.length === 0 ? (
              <Card variant="outline" className="mt-4">
                <CardDescription>{t('jobsPage.noHistory')}</CardDescription>
              </Card>
            ) : (
              <>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="job-history-field-filter">{t('jobsPage.historyFilterLabel')}</Label>
                  <select
                    id="job-history-field-filter"
                    value={historyFieldFilter}
                    onChange={(e) => setHistoryFieldFilter(e.target.value)}
                    className="h-10 w-full border border-black bg-transparent px-3 text-sm rounded-none"
                  >
                    <option value="all">{t('jobsPage.historyFilterAll')}</option>
                    {historyFieldOptions.map((field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    ))}
                  </select>
                </div>

                {filteredHistoryEntries.length === 0 ? (
                  <Card variant="outline" className="mt-4">
                    <CardDescription>{t('jobsPage.noHistoryForFilter')}</CardDescription>
                  </Card>
                ) : (
                  <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                    {filteredHistoryEntries.map((entry, index) => {
                      const entryChanges =
                        entry.changes?.filter((change) =>
                          historyFieldFilter === 'all' ? true : change.field === historyFieldFilter
                        ) || [];

                      return (
                        <Card key={`${entry.changedAt}-${index}`} variant="outline" className="space-y-2">
                          <p className="font-mono text-[11px] uppercase text-gray-600">
                            {formatDateTime(entry.changedAt)}
                          </p>
                          <p className="text-sm text-gray-800">
                            {entry.summary || t('jobsPage.historyFallbackSummary')}
                          </p>
                          <p className="font-mono text-[11px] uppercase text-blue-700">
                            {t('jobsPage.changedFieldsLabel')}: {entry.changedFields.join(', ') || '-'}
                          </p>

                          {entryChanges.length ? (
                            <div className="space-y-2 pt-1">
                              {entryChanges.map((change, changeIndex) => (
                                <div key={`${change.field}-${changeIndex}`} className="border border-black p-2">
                                  <p className="font-mono text-[11px] uppercase text-gray-700">
                                    {change.field}
                                  </p>
                                  <p className="text-xs text-red-700">
                                    {t('jobsPage.beforeLabel')}: {change.before ?? t('common.unknown')}
                                  </p>
                                  <p className="text-xs text-green-700">
                                    {t('jobsPage.afterLabel')}: {change.after ?? t('common.unknown')}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setIsHistoryDialogOpen(false)}>
                {t('common.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('jobsPage.prev')}
          </Button>
          <span className="font-mono text-xs uppercase">
            {t('jobsPage.pageLabel', { page, totalPages })}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('jobsPage.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
