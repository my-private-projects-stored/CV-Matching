import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMutableSearchParams } from './utils/search-params';

const mockedReplace = vi.fn();
const mockedPush = vi.fn();
const searchParamsHarness = createMutableSearchParams();
const mockedSearchParams = searchParamsHarness.params;
const mockedScrollIntoView = vi.fn();
const mockedAuthUser: { id: string; role: 'candidate' | 'recruiter' | 'admin' } = {
  id: 'recruiter-1',
  role: 'recruiter',
};

type RankedRequestParams = {
  jobId?: string;
  page?: number;
  changedBy?: string;
  changedAfter?: string;
  changedBefore?: string;
};

type StatusChangesRequestParams = {
  jobId?: string;
  page?: number;
  status?: string;
  changedBy?: string;
  changedAfter?: string;
  changedBefore?: string;
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function expectLatestReplaceHrefContains(parts: string[]) {
  expectLatestHrefContains(mockedReplace, parts);
}

function loadRecruiterJob(jobId = 'job-1') {
  fillInputByPlaceholder('applicationsPage.recruiterView.jobIdPlaceholder', jobId);
  clickFirstButtonByName('applicationsPage.load');
}

async function loadRecruiterAndWaitRanked(jobId = 'job-1') {
  loadRecruiterJob(jobId);
  await waitFor(() => {
    expect(mockedFetchRankedApplications).toHaveBeenCalled();
  });
}

async function loadRecruiterAndWaitStatusChanges(jobId = 'job-1') {
  loadRecruiterJob(jobId);
  await waitFor(() => {
    expect(mockedFetchRecentStatusChanges).toHaveBeenCalled();
  });
}

function getLatestRankedParams() {
  return getLatestMockCallArg<RankedRequestParams>(mockedFetchRankedApplications);
}

function getLatestStatusChangesParams() {
  return getLatestMockCallArg<StatusChangesRequestParams>(mockedFetchRecentStatusChanges);
}

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockedSearchParams,
  usePathname: () => '/applications',
  useRouter: () => ({ replace: mockedReplace, push: mockedPush }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({
    user: mockedAuthUser,
  }),
}));

vi.mock('@/lib/api/applications', () => ({
  bulkUpdateApplicationStatus: vi.fn(),
  exportRecentStatusChangesCsv: vi.fn(),
  fetchApplicationFeedback: vi.fn(),
  fetchCandidateApplicationHistory: vi.fn(),
  fetchRecentStatusChanges: vi.fn(),
  fetchApplicationStatusHistory: vi.fn(),
  fetchApplicationStatusSummary: vi.fn(),
  fetchRankedApplications: vi.fn(),
  updateApplicationStatus: vi.fn(),
}));

vi.mock('@/lib/api/candidate-profile', () => ({
  fetchCandidateProfileById: vi.fn(),
}));

vi.mock('@/lib/utils/download', () => ({
  downloadBlobAsFile: vi.fn(),
}));

import ApplicationsPage from '@/app/(default)/applications/page';
import {
  bulkUpdateApplicationStatus,
  fetchApplicationFeedback,
  fetchApplicationStatusHistory,
  exportRecentStatusChangesCsv,
  fetchApplicationStatusSummary,
  fetchCandidateApplicationHistory,
  fetchRankedApplications,
  fetchRecentStatusChanges,
} from '@/lib/api/applications';
import { fetchCandidateProfileById } from '@/lib/api/candidate-profile';
import { downloadBlobAsFile } from '@/lib/utils/download';
import {
  clickFirstButtonByName,
  expectLatestHrefHasQueryKeys,
  expectLatestHrefContains,
  expectLatestHrefQueryValues,
  fillInputByPlaceholder,
  getLatestMockCallArg,
} from './utils/page-test-helpers';

const mockedFetchRankedApplications = vi.mocked(fetchRankedApplications);
const mockedFetchApplicationStatusSummary = vi.mocked(fetchApplicationStatusSummary);
const mockedFetchCandidateApplicationHistory = vi.mocked(fetchCandidateApplicationHistory);
const mockedFetchRecentStatusChanges = vi.mocked(fetchRecentStatusChanges);
const mockedFetchApplicationFeedback = vi.mocked(fetchApplicationFeedback);
const mockedFetchApplicationStatusHistory = vi.mocked(fetchApplicationStatusHistory);
const mockedBulkUpdateApplicationStatus = vi.mocked(bulkUpdateApplicationStatus);
const mockedExportRecentStatusChangesCsv = vi.mocked(exportRecentStatusChangesCsv);
const mockedDownloadBlobAsFile = vi.mocked(downloadBlobAsFile);
const mockedFetchCandidateProfileById = vi.mocked(fetchCandidateProfileById);

describe('ApplicationsPage status changes filters', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockedAuthUser.id = 'recruiter-1';
    mockedAuthUser.role = 'recruiter';
    searchParamsHarness.reset();
    mockedReplace.mockReset();
    mockedPush.mockReset();
    mockedScrollIntoView.mockReset();
    mockedFetchRankedApplications.mockReset();
    mockedFetchApplicationStatusSummary.mockReset();
    mockedFetchCandidateApplicationHistory.mockReset();
    mockedFetchRecentStatusChanges.mockReset();
    mockedFetchApplicationFeedback.mockReset();
    mockedFetchApplicationStatusHistory.mockReset();
    mockedBulkUpdateApplicationStatus.mockReset();
    mockedExportRecentStatusChangesCsv.mockReset();
    mockedDownloadBlobAsFile.mockReset();
    mockedFetchCandidateProfileById.mockReset();

    mockedFetchRankedApplications.mockResolvedValue({
      request_id: 'req-ranked',
      data: {
        job: { id: 'job-1', title: 'Backend Engineer', status: 'active' },
        candidates: [
          {
            application_id: 'app-1',
            status: 'screening',
            ai_status: 'completed',
            candidate: { id: 'c-1', full_name: 'Candidate One', email: 'one@example.com' },
            resume: { id: 'r-1', title: 'Resume One', processing_status: 'ready' },
            scores: { semantic_score: 0.8, keyword_score: 0.7, hybrid_score: 0.75 },
            explainability: { matched_keywords: ['node'], missing_keywords: ['redis'] },
            updated_at: '2026-03-23T00:00:00.000Z',
            status_audit: null,
          },
          {
            application_id: 'app-2',
            status: 'interview',
            ai_status: 'completed',
            candidate: { id: 'c-2', full_name: 'Candidate Two', email: 'two@example.com' },
            resume: { id: 'r-2', title: 'Resume Two', processing_status: 'ready' },
            scores: { semantic_score: 0.85, keyword_score: 0.72, hybrid_score: 0.78 },
            explainability: { matched_keywords: ['react'], missing_keywords: ['k8s'] },
            updated_at: '2026-03-23T00:00:00.000Z',
            status_audit: null,
          },
        ],
        pagination: { page: 1, limit: 20, total: 0, total_pages: 1 },
      },
    });

    mockedFetchApplicationStatusSummary.mockResolvedValue({
      request_id: 'req-summary',
      data: {
        job: { id: 'job-1', title: 'Backend Engineer' },
        total: 0,
        by_status: {
          new: 0,
          screening: 0,
          interview: 0,
          offer: 0,
          hired: 0,
          rejected: 0,
        },
        by_ai_status: {
          pending: 0,
          parsing: 0,
          scoring: 0,
          completed: 0,
          failed: 0,
        },
      },
    });

    mockedFetchCandidateApplicationHistory.mockResolvedValue({
      request_id: 'req-history',
      data: {
        candidate_id: 'candidate-1',
        applications: [],
        pagination: { page: 1, limit: 20, total: 0, total_pages: 1 },
      },
    });

    mockedFetchRecentStatusChanges.mockResolvedValue({
      request_id: 'req-status',
      data: {
        job: { id: 'job-1', title: 'Backend Engineer' },
        changes: [],
        pagination: { page: 1, limit: 20, total: 0, total_pages: 1 },
      },
    });

    mockedFetchApplicationStatusHistory.mockResolvedValue({
      request_id: 'req-status-history',
      data: {
        application_id: 'app-2',
        current_status: 'interview',
        history: [
          {
            from_status: 'screening',
            to_status: 'interview',
            changed_at: '2026-03-24T00:00:00.000Z',
            changed_by: 'recruiter@example.com',
          },
        ],
      },
    });

    mockedFetchApplicationFeedback.mockResolvedValue({
      request_id: 'req-feedback',
      data: {
        application_id: 'app-2',
        job_id: 'job-1',
        resume_id: 'r-2',
        scores: {
          semantic_score: 0.9,
          keyword_score: 0.8,
          hybrid_score: 0.85,
        },
        explainability: {
          matched_keywords: ['node'],
          missing_keywords: ['redis'],
        },
        recommendations: ['Add metrics ownership examples'],
        status: 'interview',
        ai_status: 'completed',
      },
    });

    mockedExportRecentStatusChangesCsv.mockResolvedValue(
      new Blob(['application_id,changed_by\napp-1,recruiter-ui\n'], { type: 'text/csv' })
    );

    mockedBulkUpdateApplicationStatus.mockResolvedValue({
      request_id: 'req-bulk',
      data: {
        requested_count: 2,
        matched_count: 2,
        updated_count: 2,
        unchanged_count: 0,
        updated_ids: ['app-1', 'app-2'],
        status: 'offer',
      },
    });

    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      value: mockedScrollIntoView,
      writable: true,
      configurable: true,
    });
  });

  it('bulk updates selected ranked candidates status', async () => {
    render(<ApplicationsPage />);

    loadRecruiterJob('job-1');

    await waitFor(() => {
      expect(screen.getAllByText('applicationsPage.rankedCandidates.selectForBulk').length).toBeGreaterThan(1);
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'applicationsPage.rankedCandidates.selectAllCurrentPage' }));
    const bulkStatusSelect = screen
      .getByText('applicationsPage.rankedCandidates.bulkStatusPlaceholder')
      .closest('select');
    expect(bulkStatusSelect).toBeTruthy();
    fireEvent.change(bulkStatusSelect as HTMLSelectElement, {
      target: { value: 'offer' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.rankedCandidates.applyBulkStatusButton' }));

    await waitFor(() => {
      expect(mockedBulkUpdateApplicationStatus).toHaveBeenCalledWith({
        applicationIds: ['app-1', 'app-2'],
        status: 'offer',
      });
      expect(screen.getByText('applicationsPage.rankedCandidates.bulkResultLine')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.rankedCandidates.undoBulkStatusButton' }));

    await waitFor(() => {
      expect(mockedBulkUpdateApplicationStatus).toHaveBeenCalledWith({
        applicationIds: ['app-1'],
        status: 'screening',
      });
      expect(mockedBulkUpdateApplicationStatus).toHaveBeenCalledWith({
        applicationIds: ['app-2'],
        status: 'interview',
      });
      expect(screen.getByText('applicationsPage.rankedCandidates.bulkUndoResultLine')).toBeInTheDocument();
    });
  });

  it('shows candidate-focused view and hides recruiter controls for candidate role', async () => {
    mockedAuthUser.id = 'candidate-1';
    mockedAuthUser.role = 'candidate';

    render(<ApplicationsPage />);

    expect(screen.queryByText('applicationsPage.recruiterView.title')).not.toBeInTheDocument();
    expect(screen.getByText('applicationsPage.candidateView.title')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedFetchCandidateApplicationHistory).toHaveBeenCalledWith(
        expect.objectContaining({ candidateId: 'candidate-1' })
      );
    });
  });

  it('opens related job board focus from candidate history item', async () => {
    mockedAuthUser.id = 'candidate-1';
    mockedAuthUser.role = 'candidate';
    mockedSearchParams.set('candidate_id', 'candidate-1');
    mockedSearchParams.set('rc_changed_by', 'qa-reviewer');
    mockedSearchParams.set('sc_preset', '7d');
    mockedFetchCandidateApplicationHistory.mockResolvedValue({
      request_id: 'req-history-open-job-board',
      data: {
        candidate_id: 'candidate-1',
        applications: [
          {
            application_id: 'app-2',
            status: 'interview',
            ai_status: 'completed',
            job: {
              id: 'job-2',
              title: 'Platform Engineer',
              status: 'active',
              location: 'Hybrid',
              category: 'IT',
            },
            resume: {
              id: 'r-2',
              title: 'Resume Two',
              processing_status: 'ready',
            },
            scores: { hybrid_score: 0.88 },
            submitted_at: '2026-03-22T00:00:00.000Z',
            updated_at: '2026-03-23T00:00:00.000Z',
            status_audit: null,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
      },
    });

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'applicationsPage.candidateHistory.openJobInBoard' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.candidateHistory.openJobInBoard' }));

    const href = getLatestMockCallArg<string>(mockedPush) || '';
    expect(href.startsWith('/jobs?')).toBe(true);

    const query = href.split('?')[1] || '';
    const params = new URLSearchParams(query);
    expect(params.get('focus_job_id')).toBe('job-2');
    expect(params.get('search')).toBe('Platform Engineer');
    expect(params.get('status')).toBe('all');
    expect(params.get('source')).toBe('applications');

    const returnQuery = params.get('applications_return_query') || '';
    const returnSnapshot = new URLSearchParams(returnQuery);
    expect(returnSnapshot.get('candidate_id')).toBe('candidate-1');
    expect(returnSnapshot.get('rc_changed_by')).toBe('qa-reviewer');
    expect(returnSnapshot.get('sc_preset')).toBe('7d');
  });

  it('preserves jobs filter and page snapshot when opening job board from candidate history item', async () => {
    mockedAuthUser.id = 'candidate-1';
    mockedAuthUser.role = 'candidate';
    mockedSearchParams.set('candidate_id', 'candidate-1');
    mockedSearchParams.set('jobs_return_query', 'search=Data+Engineer&status=active&page=3&location=Remote');
    mockedFetchCandidateApplicationHistory.mockResolvedValue({
      request_id: 'req-history-open-job-board-with-jobs-snapshot',
      data: {
        candidate_id: 'candidate-1',
        applications: [
          {
            application_id: 'app-2',
            status: 'interview',
            ai_status: 'completed',
            job: {
              id: 'job-2',
              title: 'Platform Engineer',
              status: 'active',
              location: 'Hybrid',
              category: 'IT',
            },
            resume: {
              id: 'r-2',
              title: 'Resume Two',
              processing_status: 'ready',
            },
            scores: { hybrid_score: 0.88 },
            submitted_at: '2026-03-22T00:00:00.000Z',
            updated_at: '2026-03-23T00:00:00.000Z',
            status_audit: null,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
      },
    });

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'applicationsPage.candidateHistory.openJobInBoard' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.candidateHistory.openJobInBoard' }));

    const href = getLatestMockCallArg<string>(mockedPush) || '';
    expect(href.startsWith('/jobs?')).toBe(true);
    const params = new URLSearchParams((href.split('?')[1] || ''));

    expect(params.get('focus_job_id')).toBe('job-2');
    expect(params.get('search')).toBe('Data Engineer');
    expect(params.get('status')).toBe('active');
    expect(params.get('page')).toBe('3');
    expect(params.get('location')).toBe('Remote');
    expect(params.get('source')).toBe('applications');
  });

  it('prioritizes applications source and strips flow context keys from return snapshot when opening job board', async () => {
    mockedAuthUser.id = 'candidate-1';
    mockedAuthUser.role = 'candidate';
    mockedSearchParams.set('candidate_id', 'candidate-1');
    mockedSearchParams.set('flow_ctx', '1');
    mockedSearchParams.set('jobs_return_query', 'search=Data+Engineer&status=active&page=2&source=flow');
    mockedFetchCandidateApplicationHistory.mockResolvedValue({
      request_id: 'req-history-open-job-board-precedence',
      data: {
        candidate_id: 'candidate-1',
        applications: [
          {
            application_id: 'app-2',
            status: 'interview',
            ai_status: 'completed',
            job: {
              id: 'job-2',
              title: 'Platform Engineer',
              status: 'active',
              location: 'Hybrid',
              category: 'IT',
            },
            resume: {
              id: 'r-2',
              title: 'Resume Two',
              processing_status: 'ready',
            },
            scores: { hybrid_score: 0.88 },
            submitted_at: '2026-03-22T00:00:00.000Z',
            updated_at: '2026-03-23T00:00:00.000Z',
            status_audit: null,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
      },
    });

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'applicationsPage.candidateHistory.openJobInBoard' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.candidateHistory.openJobInBoard' }));

    const href = getLatestMockCallArg<string>(mockedPush) || '';
    const params = new URLSearchParams(href.split('?')[1] || '');
    expect(params.get('source')).toBe('applications');

    const returnQuery = params.get('applications_return_query') || '';
    const returnSnapshot = new URLSearchParams(returnQuery);
    expect(returnSnapshot.get('flow_ctx')).toBeNull();
    expect(returnSnapshot.get('jobs_return_query')).toBeNull();
  });

  it('applies fixed filter precedence from jobs_return_query over top-level duplicates when opening job board', async () => {
    mockedAuthUser.id = 'candidate-1';
    mockedAuthUser.role = 'candidate';
    mockedSearchParams.set('candidate_id', 'candidate-1');
    mockedSearchParams.set('search', 'Top Level Search');
    mockedSearchParams.set('status', 'closed');
    mockedSearchParams.set('page', '9');
    mockedSearchParams.set('location', 'Onsite');
    mockedSearchParams.set(
      'jobs_return_query',
      'search=Nested+Search&status=active&page=2&location=Remote'
    );
    mockedFetchCandidateApplicationHistory.mockResolvedValue({
      request_id: 'req-history-open-job-board-fixed-precedence',
      data: {
        candidate_id: 'candidate-1',
        applications: [
          {
            application_id: 'app-2',
            status: 'interview',
            ai_status: 'completed',
            job: {
              id: 'job-2',
              title: 'Platform Engineer',
              status: 'active',
              location: 'Hybrid',
              category: 'IT',
            },
            resume: {
              id: 'r-2',
              title: 'Resume Two',
              processing_status: 'ready',
            },
            scores: { hybrid_score: 0.88 },
            submitted_at: '2026-03-22T00:00:00.000Z',
            updated_at: '2026-03-23T00:00:00.000Z',
            status_audit: null,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
      },
    });

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'applicationsPage.candidateHistory.openJobInBoard' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.candidateHistory.openJobInBoard' }));

    const href = getLatestMockCallArg<string>(mockedPush) || '';
    const params = new URLSearchParams(href.split('?')[1] || '');
    expect(params.get('search')).toBe('Nested Search');
    expect(params.get('status')).toBe('active');
    expect(params.get('page')).toBe('2');
    expect(params.get('location')).toBe('Remote');
  });

  it('sanitizes nested jobs snapshot recursion when opening job board from candidate history item', async () => {
    mockedAuthUser.id = 'candidate-1';
    mockedAuthUser.role = 'candidate';
    mockedSearchParams.set('candidate_id', 'candidate-1');
    mockedSearchParams.set(
      'jobs_return_query',
      'search=Nested+Search&status=active&jobs_return_query=page%3D2&applications_return_query=rc_focus%3Dfocus'
    );
    mockedFetchCandidateApplicationHistory.mockResolvedValue({
      request_id: 'req-history-open-job-board-sanitize-nested',
      data: {
        candidate_id: 'candidate-1',
        applications: [
          {
            application_id: 'app-2',
            status: 'interview',
            ai_status: 'completed',
            job: {
              id: 'job-2',
              title: 'Platform Engineer',
              status: 'active',
              location: 'Hybrid',
              category: 'IT',
            },
            resume: {
              id: 'r-2',
              title: 'Resume Two',
              processing_status: 'ready',
            },
            scores: { hybrid_score: 0.88 },
            submitted_at: '2026-03-22T00:00:00.000Z',
            updated_at: '2026-03-23T00:00:00.000Z',
            status_audit: null,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
      },
    });

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'applicationsPage.candidateHistory.openJobInBoard' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.candidateHistory.openJobInBoard' }));

    const href = getLatestMockCallArg<string>(mockedPush) || '';
    const params = new URLSearchParams(href.split('?')[1] || '');
    expect(params.get('search')).toBe('Nested Search');
    expect(params.get('status')).toBe('active');
    expect(params.get('jobs_return_query')).toBeNull();

    const returnSnapshot = new URLSearchParams(params.get('applications_return_query') || '');
    expect(returnSnapshot.get('candidate_id')).toBe('candidate-1');
    expect(returnSnapshot.get('jobs_return_query')).toBeNull();
  });

  it('highlights candidate history item from candidate_focus deep-link and clears focus', async () => {
    mockedAuthUser.id = 'candidate-1';
    mockedAuthUser.role = 'candidate';
    mockedSearchParams.set('candidate_id', 'candidate-1');
    mockedSearchParams.set('application_id', 'app-2');
    mockedSearchParams.set('candidate_focus', '1');

    mockedFetchCandidateApplicationHistory.mockResolvedValue({
      request_id: 'req-history-candidate-focus',
      data: {
        candidate_id: 'candidate-1',
        applications: [
          {
            application_id: 'app-1',
            status: 'screening',
            ai_status: 'completed',
            job: {
              id: 'job-1',
              title: 'Backend Engineer',
              status: 'active',
              location: 'Remote',
              category: 'IT',
            },
            resume: {
              id: 'r-1',
              title: 'Resume One',
              processing_status: 'ready',
            },
            scores: { hybrid_score: 0.75 },
            submitted_at: '2026-03-20T00:00:00.000Z',
            updated_at: '2026-03-21T00:00:00.000Z',
            status_audit: null,
          },
          {
            application_id: 'app-2',
            status: 'interview',
            ai_status: 'completed',
            job: {
              id: 'job-2',
              title: 'Platform Engineer',
              status: 'active',
              location: 'Hybrid',
              category: 'IT',
            },
            resume: {
              id: 'r-2',
              title: 'Resume Two',
              processing_status: 'ready',
            },
            scores: { hybrid_score: 0.88 },
            submitted_at: '2026-03-22T00:00:00.000Z',
            updated_at: '2026-03-23T00:00:00.000Z',
            status_audit: null,
          },
        ],
        pagination: { page: 1, limit: 20, total: 2, total_pages: 1 },
      },
    });

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(screen.getByText('applicationsPage.candidateHistory.focusedApplicationVisible')).toBeInTheDocument();
      expect(screen.getByText('applicationsPage.candidateHistory.focusBadge')).toBeInTheDocument();
      const focusedHistoryRow = document.querySelector('[data-candidate-history-focused="true"]');
      expect(focusedHistoryRow).toBeTruthy();
      expect(focusedHistoryRow?.textContent).toContain('Platform Engineer');
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'applicationsPage.candidateHistory.clearFocusedApplication' })
    );

    await waitFor(() => {
      expect(screen.queryByText('applicationsPage.candidateHistory.focusedApplicationVisible')).not.toBeInTheDocument();
      const focusedHistoryRow = document.querySelector('[data-candidate-history-focused="true"]');
      expect(focusedHistoryRow).toBeNull();
      const latestHref = getLatestMockCallArg<string>(mockedReplace) || '';
      expect(latestHref).toContain('candidate_id=candidate-1');
      expect(latestHref).not.toContain('candidate_focus=1');
      expect(latestHref).not.toContain('application_id=app-2');
    });
  });

  it('auto-seeks focused candidate history item on other history pages', async () => {
    mockedAuthUser.id = 'candidate-1';
    mockedAuthUser.role = 'candidate';
    mockedSearchParams.set('candidate_id', 'candidate-1');
    mockedSearchParams.set('application_id', 'app-target');
    mockedSearchParams.set('candidate_focus', '1');

    mockedFetchCandidateApplicationHistory.mockImplementation(async (params) => {
      const page = params?.page || 1;

      if (page === 2) {
        return {
          request_id: 'req-history-page-2',
          data: {
            candidate_id: 'candidate-1',
            applications: [
              {
                application_id: 'app-target',
                status: 'interview',
                ai_status: 'completed',
                job: {
                  id: 'job-2',
                  title: 'Platform Engineer',
                  status: 'active',
                  location: 'Hybrid',
                  category: 'IT',
                },
                resume: {
                  id: 'r-target',
                  title: 'Resume Target',
                  processing_status: 'ready',
                },
                scores: { hybrid_score: 0.92 },
                submitted_at: '2026-03-25T00:00:00.000Z',
                updated_at: '2026-03-26T00:00:00.000Z',
                status_audit: null,
              },
            ],
            pagination: { page: 2, limit: 20, total: 21, total_pages: 2 },
          },
        };
      }

      return {
        request_id: 'req-history-page-1',
        data: {
          candidate_id: 'candidate-1',
          applications: [
            {
              application_id: 'app-1',
              status: 'screening',
              ai_status: 'completed',
              job: {
                id: 'job-1',
                title: 'Backend Engineer',
                status: 'active',
                location: 'Remote',
                category: 'IT',
              },
              resume: {
                id: 'r-1',
                title: 'Resume One',
                processing_status: 'ready',
              },
              scores: { hybrid_score: 0.75 },
              submitted_at: '2026-03-20T00:00:00.000Z',
              updated_at: '2026-03-21T00:00:00.000Z',
              status_audit: null,
            },
          ],
          pagination: { page: 1, limit: 20, total: 21, total_pages: 2 },
        },
      };
    });

    render(<ApplicationsPage />);

    await waitFor(() => {
      const pageTwoCall = mockedFetchCandidateApplicationHistory.mock.calls.find(
        (call) => call[0]?.page === 2
      );
      expect(pageTwoCall).toBeDefined();
      expect(screen.getByText('applicationsPage.candidateHistory.focusedApplicationVisible')).toBeInTheDocument();
      expect(screen.getByText('applicationsPage.candidateHistory.focusBadge')).toBeInTheDocument();
      const focusedHistoryRow = document.querySelector('[data-candidate-history-focused="true"]');
      expect(focusedHistoryRow).toBeTruthy();
      expect(focusedHistoryRow?.textContent).toContain('Platform Engineer');
    });
  });

  it('ignores stale in-flight candidate history seek result after focus is cleared', async () => {
    mockedAuthUser.id = 'candidate-1';
    mockedAuthUser.role = 'candidate';
    mockedSearchParams.set('candidate_id', 'candidate-1');
    mockedSearchParams.set('application_id', 'app-target');
    mockedSearchParams.set('candidate_focus', '1');

    const pageTwoDeferred = createDeferred<Awaited<ReturnType<typeof fetchCandidateApplicationHistory>>>();

    mockedFetchCandidateApplicationHistory.mockImplementation(async (params) => {
      const page = params?.page || 1;

      if (page === 2) {
        return pageTwoDeferred.promise;
      }

      return {
        request_id: 'req-history-page-1-stale-clear-focus',
        data: {
          candidate_id: 'candidate-1',
          applications: [
            {
              application_id: 'app-1',
              status: 'screening',
              ai_status: 'completed',
              job: {
                id: 'job-1',
                title: 'Backend Engineer',
                status: 'active',
                location: 'Remote',
                category: 'IT',
              },
              resume: {
                id: 'r-1',
                title: 'Resume One',
                processing_status: 'ready',
              },
              scores: { hybrid_score: 0.75 },
              submitted_at: '2026-03-20T00:00:00.000Z',
              updated_at: '2026-03-21T00:00:00.000Z',
              status_audit: null,
            },
          ],
          pagination: { page: 1, limit: 20, total: 21, total_pages: 2 },
        },
      };
    });

    render(<ApplicationsPage />);

    await waitFor(() => {
      const pageTwoCalls = mockedFetchCandidateApplicationHistory.mock.calls.filter(
        (call) => call[0]?.page === 2
      );
      expect(pageTwoCalls).toHaveLength(1);
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'applicationsPage.candidateHistory.clearFocusedApplication' })
    );

    await waitFor(() => {
      const latestHref = getLatestMockCallArg<string>(mockedReplace) || '';
      expect(latestHref).toContain('candidate_id=candidate-1');
      expect(latestHref).not.toContain('candidate_focus=1');
      expect(latestHref).not.toContain('application_id=app-target');
    });

    pageTwoDeferred.resolve({
      request_id: 'req-history-page-2-stale-clear-focus',
      data: {
        candidate_id: 'candidate-1',
        applications: [
          {
            application_id: 'app-target',
            status: 'interview',
            ai_status: 'completed',
            job: {
              id: 'job-2',
              title: 'Platform Engineer',
              status: 'active',
              location: 'Hybrid',
              category: 'IT',
            },
            resume: {
              id: 'r-target',
              title: 'Resume Target',
              processing_status: 'ready',
            },
            scores: { hybrid_score: 0.92 },
            submitted_at: '2026-03-25T00:00:00.000Z',
            updated_at: '2026-03-26T00:00:00.000Z',
            status_audit: null,
          },
        ],
        pagination: { page: 2, limit: 20, total: 21, total_pages: 2 },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    const pageTwoCallsAfterResolve = mockedFetchCandidateApplicationHistory.mock.calls.filter(
      (call) => call[0]?.page === 2
    );
    expect(pageTwoCallsAfterResolve).toHaveLength(1);
  });

  it('filters ranked candidates by latest changed_by', async () => {
    render(<ApplicationsPage />);

    fireEvent.change(screen.getByPlaceholderText('applicationsPage.recruiterView.jobIdPlaceholder'), {
      target: { value: 'job-1' },
    });
    fireEvent.change(screen.getByPlaceholderText('applicationsPage.recruiterView.changedByFilterPlaceholder'), {
      target: { value: 'qa-reviewer' },
    });
    fireEvent.change(screen.getByLabelText('applicationsPage.recruiterView.changedAfterLabel'), {
      target: { value: '2026-03-10' },
    });
    fireEvent.change(screen.getByLabelText('applicationsPage.recruiterView.changedBeforeLabel'), {
      target: { value: '2026-03-20' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'applicationsPage.load' })[0]);

    await waitFor(() => {
      expect(mockedFetchRankedApplications).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-1',
          changedBy: 'qa-reviewer',
          changedAfter: '2026-03-10',
          changedBefore: '2026-03-20',
        })
      );
    });
  });

  it('syncs ranked changed_by and date filters to query string', async () => {
    render(<ApplicationsPage />);

    fireEvent.change(screen.getByPlaceholderText('applicationsPage.recruiterView.jobIdPlaceholder'), {
      target: { value: 'job-1' },
    });
    fireEvent.change(screen.getByPlaceholderText('applicationsPage.recruiterView.changedByFilterPlaceholder'), {
      target: { value: 'qa-reviewer' },
    });
    fireEvent.change(screen.getByLabelText('applicationsPage.recruiterView.changedAfterLabel'), {
      target: { value: '2026-03-10' },
    });
    fireEvent.change(screen.getByLabelText('applicationsPage.recruiterView.changedBeforeLabel'), {
      target: { value: '2026-03-20' },
    });

    await waitFor(() => {
      expectLatestHrefContains(mockedReplace, ['/applications?']);
      expectLatestHrefQueryValues(mockedReplace, {
        job_id: 'job-1',
        rc_changed_by: 'qa-reviewer',
        rc_after: '2026-03-10',
        rc_before: '2026-03-20',
      });
    });
  });

  it('applies ranked quick preset and sends ranked changedAfter/changedBefore', async () => {
    render(<ApplicationsPage />);

    await loadRecruiterAndWaitRanked('job-1');

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.recruiterView.preset.qtd' }));

    await waitFor(() => {
      const latest = getLatestRankedParams();
      expect(latest?.jobId).toBe('job-1');
      expect(latest?.changedAfter).toMatch(/^\d{4}-(01|04|07|10)-01$/);
      expect(latest?.changedBefore).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('syncs ranked preset to query string for shareable URL', async () => {
    render(<ApplicationsPage />);

    await loadRecruiterAndWaitRanked('job-1');

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.recruiterView.preset.7d' }));

    await waitFor(() => {
      expectLatestHrefContains(mockedReplace, ['/applications?']);
      expectLatestHrefQueryValues(mockedReplace, {
        job_id: 'job-1',
        rc_preset: '7d',
      });
      expectLatestHrefHasQueryKeys(mockedReplace, ['rc_after', 'rc_before']);
    });
  });

  it.each([
    {
      preset: 'qtd',
      jobId: 'job-2',
      expectedAfter: /^\d{4}-(01|04|07|10)-01$/,
      expectedBefore: /^\d{4}-\d{2}-\d{2}$/,
    },
    {
      preset: 'all-time',
      jobId: 'job-3',
      expectedAfter: '',
      expectedBefore: '',
    },
    {
      preset: '7d',
      jobId: 'job-4',
      expectedAfter: /^\d{4}-\d{2}-\d{2}$/,
      expectedBefore: /^\d{4}-\d{2}-\d{2}$/,
    },
    {
      preset: 'this-month',
      jobId: 'job-5',
      expectedAfter: /^\d{4}-\d{2}-01$/,
      expectedBefore: /^\d{4}-\d{2}-\d{2}$/,
    },
  ])(
    'hydrates ranked $preset preset from URL query',
    async ({ preset, jobId, expectedAfter, expectedBefore }) => {
      mockedSearchParams.set('job_id', jobId);
      mockedSearchParams.set('rc_preset', preset);

      render(<ApplicationsPage />);

      await waitFor(() => {
        expect(mockedFetchRankedApplications).toHaveBeenCalled();
        const firstCall = getLatestRankedParams();
        expect(firstCall?.jobId).toBe(jobId);

        if (typeof expectedAfter === 'string') {
          expect(firstCall?.changedAfter).toBe(expectedAfter);
        } else {
          expect(firstCall?.changedAfter).toMatch(expectedAfter);
        }

        if (typeof expectedBefore === 'string') {
          expect(firstCall?.changedBefore).toBe(expectedBefore);
        } else {
          expect(firstCall?.changedBefore).toMatch(expectedBefore);
        }
      });
    }
  );

  it('ignores invalid ranked preset from URL query and keeps ranked date filters empty', async () => {
    mockedSearchParams.set('job_id', 'job-invalid-ranked');
    mockedSearchParams.set('rc_preset', 'invalid-ranked-preset');

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(mockedFetchRankedApplications).toHaveBeenCalled();
      const firstCall = getLatestRankedParams();
      expect(firstCall?.jobId).toBe('job-invalid-ranked');
      expect(firstCall?.changedAfter).toBe('');
      expect(firstCall?.changedBefore).toBe('');
    });
  });

  it('focuses ranked candidate card from application_id query', async () => {
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-2');

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(mockedFetchRankedApplications).toHaveBeenCalled();
      expect(screen.getByText('applicationsPage.rankedCandidates.focusedApplication')).toBeInTheDocument();
    });

    const focusedCard = screen.getByText('Candidate Two').closest('[data-focused="true"]');
    expect(focusedCard).toBeTruthy();
    expect(screen.getByText('applicationsPage.rankedCandidates.focusBadge')).toBeInTheDocument();
  });

  it('enables focus-only mode by default for deep-link focus and can toggle back to full list', async () => {
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-2');

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(screen.getByText('applicationsPage.rankedCandidates.focusedApplicationOnlyMode')).toBeInTheDocument();
      expect(screen.getByText('Candidate Two')).toBeInTheDocument();
      expect(screen.queryByText('Candidate One')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.rankedCandidates.focusOnlyDisable' }));

    await waitFor(() => {
      expect(screen.getByText('Candidate One')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'applicationsPage.rankedCandidates.focusOnlyEnable' })).toBeInTheDocument();
    });
  });

  it('hydrates full-list focus mode from rc_focus=all query', async () => {
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-2');
    mockedSearchParams.set('rc_focus', 'all');

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Candidate One')).toBeInTheDocument();
      expect(screen.getByText('Candidate Two')).toBeInTheDocument();
      expect(screen.queryByText('applicationsPage.rankedCandidates.focusedApplicationOnlyMode')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'applicationsPage.rankedCandidates.focusOnlyEnable' })).toBeInTheDocument();
    });
  });

  it('syncs focus mode changes to rc_focus query for shareable links', async () => {
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-2');

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(screen.getByText('applicationsPage.rankedCandidates.focusedApplicationOnlyMode')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.rankedCandidates.focusOnlyDisable' }));

    await waitFor(() => {
      expectLatestHrefContains(mockedReplace, ['/applications?']);
      expectLatestHrefQueryValues(mockedReplace, {
        job_id: 'job-1',
        application_id: 'app-2',
        rc_focus: 'all',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.rankedCandidates.focusOnlyEnable' }));

    await waitFor(() => {
      expectLatestHrefQueryValues(mockedReplace, {
        job_id: 'job-1',
        application_id: 'app-2',
        rc_focus: 'focus',
      });
    });
  });

  it('clears focused application via recruiter summary chip', async () => {
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-2');

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(screen.getByText('applicationsPage.recruiterView.summaryFocusedApplication')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('applicationsPage.recruiterView.summaryFocusedApplication'));

    await waitFor(() => {
      const latestHref = getLatestMockCallArg<string>(mockedReplace) || '';
      expect(latestHref).toContain('job_id=job-1');
      expect(latestHref).not.toContain('application_id=');
    });
  });

  it('clears application focus and removes application_id from query', async () => {
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-2');

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'applicationsPage.rankedCandidates.clearFocusedApplication' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.rankedCandidates.clearFocusedApplication' }));

    await waitFor(() => {
      const latestHref = getLatestMockCallArg<string>(mockedReplace) || '';
      expect(latestHref).toContain('job_id=job-1');
      expect(latestHref).not.toContain('application_id=');
    });
  });

  it('auto-seeks focused application on other ranked pages and jumps to matching page', async () => {
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-target');

    mockedFetchRankedApplications.mockImplementation(async (params) => {
      const page = params?.page || 1;

      if (page === 2) {
        return {
          request_id: 'req-ranked-page-2',
          data: {
            job: { id: 'job-1', title: 'Backend Engineer', status: 'active' },
            candidates: [
              {
                application_id: 'app-target',
                status: 'interview',
                ai_status: 'completed',
                candidate: { id: 'c-target', full_name: 'Candidate Target', email: 'target@example.com' },
                resume: { id: 'r-target', title: 'Resume Target', processing_status: 'ready' },
                scores: { semantic_score: 0.93, keyword_score: 0.88, hybrid_score: 0.9 },
                explainability: { matched_keywords: ['node'], missing_keywords: ['redis'] },
                updated_at: '2026-03-24T00:00:00.000Z',
                status_audit: null,
              },
            ],
            pagination: { page: 2, limit: 20, total: 21, total_pages: 2 },
          },
        };
      }

      return {
        request_id: 'req-ranked-page-1',
        data: {
          job: { id: 'job-1', title: 'Backend Engineer', status: 'active' },
          candidates: [
            {
              application_id: 'app-1',
              status: 'screening',
              ai_status: 'completed',
              candidate: { id: 'c-1', full_name: 'Candidate One', email: 'one@example.com' },
              resume: { id: 'r-1', title: 'Resume One', processing_status: 'ready' },
              scores: { semantic_score: 0.8, keyword_score: 0.7, hybrid_score: 0.75 },
              explainability: { matched_keywords: ['node'], missing_keywords: ['redis'] },
              updated_at: '2026-03-23T00:00:00.000Z',
              status_audit: null,
            },
          ],
          pagination: { page: 1, limit: 20, total: 21, total_pages: 2 },
        },
      };
    });

    render(<ApplicationsPage />);

    await waitFor(() => {
      const pageTwoCall = mockedFetchRankedApplications.mock.calls.find(
        (call) => call[0]?.page === 2
      );
      expect(pageTwoCall).toBeDefined();
      expect(screen.getByText('applicationsPage.rankedCandidates.focusedApplication')).toBeInTheDocument();
      expect(screen.getByText('Candidate Target')).toBeInTheDocument();
      expect(screen.getByText('applicationsPage.rankedCandidates.focusBadge')).toBeInTheDocument();
    });
  });

  it('ignores stale in-flight ranked seek result after focus is cleared', async () => {
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-target');

    const pageTwoDeferred = createDeferred<Awaited<ReturnType<typeof fetchRankedApplications>>>();

    mockedFetchRankedApplications.mockImplementation(async (params) => {
      const page = params?.page || 1;

      if (page === 2) {
        return pageTwoDeferred.promise;
      }

      return {
        request_id: 'req-ranked-page-1-stale-clear-focus',
        data: {
          job: { id: 'job-1', title: 'Backend Engineer', status: 'active' },
          candidates: [
            {
              application_id: 'app-1',
              status: 'screening',
              ai_status: 'completed',
              candidate: { id: 'c-1', full_name: 'Candidate One', email: 'one@example.com' },
              resume: { id: 'r-1', title: 'Resume One', processing_status: 'ready' },
              scores: { semantic_score: 0.8, keyword_score: 0.7, hybrid_score: 0.75 },
              explainability: { matched_keywords: ['node'], missing_keywords: ['redis'] },
              updated_at: '2026-03-23T00:00:00.000Z',
              status_audit: null,
            },
          ],
          pagination: { page: 1, limit: 20, total: 21, total_pages: 2 },
        },
      };
    });

    render(<ApplicationsPage />);

    await waitFor(() => {
      const pageTwoCalls = mockedFetchRankedApplications.mock.calls.filter((call) => call[0]?.page === 2);
      expect(pageTwoCalls).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.rankedCandidates.clearFocusedApplication' }));

    await waitFor(() => {
      const latestHref = getLatestMockCallArg<string>(mockedReplace) || '';
      expect(latestHref).toContain('job_id=job-1');
      expect(latestHref).not.toContain('application_id=app-target');
    });

    pageTwoDeferred.resolve({
      request_id: 'req-ranked-page-2-stale-clear-focus',
      data: {
        job: { id: 'job-1', title: 'Backend Engineer', status: 'active' },
        candidates: [
          {
            application_id: 'app-target',
            status: 'interview',
            ai_status: 'completed',
            candidate: { id: 'c-target', full_name: 'Candidate Target', email: 'target@example.com' },
            resume: { id: 'r-target', title: 'Resume Target', processing_status: 'ready' },
            scores: { semantic_score: 0.93, keyword_score: 0.88, hybrid_score: 0.9 },
            explainability: { matched_keywords: ['node'], missing_keywords: ['redis'] },
            updated_at: '2026-03-24T00:00:00.000Z',
            status_audit: null,
          },
        ],
        pagination: { page: 2, limit: 20, total: 21, total_pages: 2 },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    const pageTwoCallsAfterResolve = mockedFetchRankedApplications.mock.calls.filter(
      (call) => call[0]?.page === 2
    );
    expect(pageTwoCallsAfterResolve).toHaveLength(1);
  });

  it('auto-opens status history from sh_open query deep-link', async () => {
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-2');
    mockedSearchParams.set('sh_open', '1');

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(mockedFetchApplicationStatusHistory).toHaveBeenCalledWith('app-2');
      expect(screen.getByText('applicationsPage.statusHistory.title')).toBeInTheDocument();
    });
  });

  it('syncs status-history panel flag to query when opened from ranked candidate actions', async () => {
    render(<ApplicationsPage />);

    await loadRecruiterAndWaitRanked('job-1');

    fireEvent.click(
      screen.getAllByRole('button', { name: 'applicationsPage.rankedCandidates.statusHistoryButton' })[0]
    );

    await waitFor(() => {
      expect(mockedFetchApplicationStatusHistory).toHaveBeenCalledWith('app-1');
      expectLatestHrefQueryValues(mockedReplace, {
        job_id: 'job-1',
        application_id: 'app-1',
        sh_open: '1',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));

    await waitFor(() => {
      const latestHref = getLatestMockCallArg<string>(mockedReplace) || '';
      expect(latestHref).toContain('job_id=job-1');
      expect(latestHref).toContain('application_id=app-1');
      expect(latestHref).not.toContain('sh_open=1');
    });
  });

  it('auto-opens feedback panel from fb_open query deep-link', async () => {
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-2');
    mockedSearchParams.set('fb_open', '1');

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(mockedFetchApplicationFeedback).toHaveBeenCalledWith('app-2');
      expect(screen.getByText('applicationsPage.feedback.title')).toBeInTheDocument();
    });
  });

  it('opens feedback panel from candidate history action', async () => {
    mockedAuthUser.id = 'candidate-1';
    mockedAuthUser.role = 'candidate';

    mockedFetchCandidateApplicationHistory.mockResolvedValue({
      request_id: 'req-history-candidate',
      data: {
        candidate_id: 'candidate-1',
        applications: [
          {
            application_id: 'app-9',
            status: 'new',
            ai_status: 'completed',
            job: {
              id: 'job-9',
              title: 'Data Engineer',
              status: 'active',
              location: null,
              category: null,
            },
            resume: {
              id: 'r-9',
              title: 'Resume Nine',
              processing_status: 'ready',
            },
            scores: {
              hybrid_score: 0.71,
            },
            submitted_at: '2026-03-23T00:00:00.000Z',
            updated_at: '2026-03-23T00:00:00.000Z',
            status_audit: null,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
      },
    });

    mockedFetchApplicationFeedback.mockResolvedValueOnce({
      request_id: 'req-feedback-candidate',
      data: {
        application_id: 'app-9',
        job_id: 'job-9',
        resume_id: 'r-9',
        scores: {
          semantic_score: 0.82,
          keyword_score: 0.64,
          hybrid_score: 0.72,
        },
        explainability: {
          matched_keywords: ['node'],
          missing_keywords: ['redis'],
        },
        recommendations: ['Consider adding evidence for: redis'],
        status: 'new',
        ai_status: 'completed',
      },
    });

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(mockedFetchCandidateApplicationHistory).toHaveBeenCalled();
      expect(
        screen.getByRole('button', { name: 'applicationsPage.candidateHistory.openFeedback' })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'applicationsPage.candidateHistory.openFeedback' })
    );

    await waitFor(() => {
      expect(mockedFetchApplicationFeedback).toHaveBeenCalledWith('app-9');
      expect(screen.getByText('applicationsPage.feedback.title')).toBeInTheDocument();
    });
  });

  it('opens candidate profile panel from ranked candidate action', async () => {
    mockedFetchCandidateProfileById.mockResolvedValue({
      data: {
        user_id: 'c-1',
        email: 'one@example.com',
        full_name: 'Candidate One',
        role: 'candidate',
        profile: {
          headline: 'Platform Engineer',
          summary: 'Focused on platform work.',
          phone: '',
          location: '',
          website: '',
          portfolio_links: [],
          skills: ['Node.js'],
          experience: [],
          education: [],
          portfolio: [],
        },
        updated_at: '2026-03-23T00:00:00.000Z',
      },
    });

    render(<ApplicationsPage />);

    await loadRecruiterAndWaitRanked('job-1');

    fireEvent.click(
      screen.getAllByRole('button', { name: 'applicationsPage.rankedCandidates.profileButton' })[0]
    );

    await waitFor(() => {
      expect(mockedFetchCandidateProfileById).toHaveBeenCalledWith('c-1');
      expect(screen.getByText('applicationsPage.candidateProfile.title')).toBeInTheDocument();
      expect(screen.getByText('Platform Engineer')).toBeInTheDocument();
    });
  });

  it('opens candidate profile panel from candidate history action and deep-links URL', async () => {
    mockedAuthUser.id = 'candidate-1';
    mockedAuthUser.role = 'candidate';
    mockedSearchParams.set('candidate_id', 'candidate-1');
    mockedFetchCandidateApplicationHistory.mockResolvedValue({
      request_id: 'req-history-profile-open',
      data: {
        candidate_id: 'candidate-1',
        applications: [
          {
            application_id: 'app-hist-1',
            candidate_id: 'c-hist-1',
            status: 'screening',
            ai_status: 'completed',
            job: {
              id: 'job-1',
              title: 'Platform Engineer',
              status: 'active',
              location: 'Hanoi',
              category: 'IT',
            },
            resume: {
              id: 'r-1',
              title: 'Resume One',
              processing_status: 'ready',
            },
            scores: { hybrid_score: 0.82 },
            submitted_at: '2026-03-22T00:00:00.000Z',
            updated_at: '2026-03-23T00:00:00.000Z',
            status_audit: null,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
      },
    });

    mockedFetchCandidateProfileById.mockResolvedValue({
      data: {
        user_id: 'c-hist-1',
        email: 'hist@example.com',
        full_name: 'Candidate Hist',
        role: 'candidate',
        profile: {
          headline: 'Hist Engineer',
          summary: 'History candidate summary.',
          phone: '',
          location: '',
          website: '',
          portfolio_links: [],
          skills: ['Node.js'],
          experience: [],
          education: [],
          portfolio: [],
        },
        updated_at: '2026-03-23T00:00:00.000Z',
      },
    });

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(mockedFetchCandidateApplicationHistory).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.candidateHistory.openProfile' }));

    await waitFor(() => {
      expect(mockedFetchCandidateProfileById).toHaveBeenCalledWith('c-hist-1');
      expect(mockedPush).toHaveBeenCalled();
      const latest = mockedPush.mock.calls[mockedPush.mock.calls.length - 1][0] as string;
      expect(latest).toContain('candidate_id=');
      expect(latest).toContain('application_id=app-hist-1');
      expect(latest).toContain('candidate_focus=1');
      expect(latest).toContain('flow_ctx=1');
      expect(screen.getByText('applicationsPage.candidateProfile.title')).toBeInTheDocument();
    });
  });

  it('opens candidate profile panel from recruiter status-changes history action and deep-links URL', async () => {
    mockedAuthUser.id = 'recruiter-1';
    mockedAuthUser.role = 'recruiter';

    mockedFetchRecentStatusChanges.mockResolvedValue({
      request_id: 'req-status-profile-open',
      data: {
        job: { id: 'job-1', title: 'Backend Engineer' },
        changes: [
          {
            application_id: 'app-sc-1',
            candidate: {
              id: 'c-status-1',
              full_name: 'Status Candidate',
              email: 'status@example.com',
            },
            from_status: 'screening',
            to_status: 'interview',
            changed_at: '2026-03-24T00:00:00.000Z',
            changed_by: 'recruiter@example.com',
            current_status: 'interview',
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
      },
    });

    mockedFetchCandidateProfileById.mockResolvedValue({
      data: {
        user_id: 'c-status-1',
        email: 'status@example.com',
        full_name: 'Status Candidate',
        role: 'candidate',
        profile: {
          headline: 'Status Engineer',
          summary: 'Status history summary text.',
          phone: '',
          location: '',
          website: '',
          portfolio_links: [],
          skills: ['Node.js'],
          experience: [],
          education: [],
          portfolio: [],
        },
        updated_at: '2026-03-23T00:00:00.000Z',
      },
    });

    render(<ApplicationsPage />);

    await loadRecruiterAndWaitStatusChanges('job-1');

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.statusChanges.profileButton' }));

    await waitFor(() => {
      expect(mockedFetchCandidateProfileById).toHaveBeenCalledWith('c-status-1');
      const latest = mockedPush.mock.calls[mockedPush.mock.calls.length - 1][0] as string;
      expect(latest).toContain('job_id=job-1');
      expect(latest).toContain('application_id=app-sc-1');
      expect(latest).toContain('sc_open=1');
      expect(latest).toContain('flow_ctx=1');
      expect(screen.getByText('applicationsPage.candidateProfile.title')).toBeInTheDocument();
    });
  });

  it('syncs and clears feedback panel flag in query from ranked candidate actions', async () => {
    render(<ApplicationsPage />);

    await loadRecruiterAndWaitRanked('job-1');

    fireEvent.click(
      screen.getAllByRole('button', { name: 'applicationsPage.rankedCandidates.feedbackButton' })[0]
    );

    await waitFor(() => {
      expect(mockedFetchApplicationFeedback).toHaveBeenCalledWith('app-1');
      expectLatestHrefQueryValues(mockedReplace, {
        job_id: 'job-1',
        application_id: 'app-1',
        fb_open: '1',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));

    await waitFor(() => {
      const latestHref = getLatestMockCallArg<string>(mockedReplace) || '';
      expect(latestHref).toContain('job_id=job-1');
      expect(latestHref).toContain('application_id=app-1');
      expect(latestHref).not.toContain('fb_open=1');
    });
  });

  it('shows feedback processing notice and empty recommendations', async () => {
    mockedFetchApplicationFeedback.mockResolvedValueOnce({
      request_id: 'req-feedback-pending',
      data: {
        application_id: 'app-1',
        job_id: 'job-1',
        resume_id: 'r-1',
        scores: {
          semantic_score: 0.3,
          keyword_score: 0.2,
          hybrid_score: 0.25,
        },
        explainability: {
          matched_keywords: [],
          missing_keywords: [],
        },
        recommendations: [],
        status: 'new',
        ai_status: 'scoring',
      },
    });

    render(<ApplicationsPage />);

    await loadRecruiterAndWaitRanked('job-1');

    fireEvent.click(
      screen.getAllByRole('button', { name: 'applicationsPage.rankedCandidates.feedbackButton' })[0]
    );

    await waitFor(() => {
      expect(mockedFetchApplicationFeedback).toHaveBeenCalledWith('app-1');
      expect(screen.getByText('applicationsPage.feedback.title')).toBeInTheDocument();
      expect(screen.getByText('applicationsPage.feedback.statusLine')).toBeInTheDocument();
      expect(screen.getAllByText('applicationsPage.feedback.none')).toHaveLength(2);
      const recommendationsLabel = screen.getByText('applicationsPage.feedback.recommendations');
      expect(recommendationsLabel.closest('div')?.querySelectorAll('li')).toHaveLength(0);
    });
  });

  it('syncs and clears status-changes panel flag in query from ranked candidate actions', async () => {
    render(<ApplicationsPage />);

    await loadRecruiterAndWaitRanked('job-1');

    fireEvent.click(
      screen.getAllByRole('button', { name: 'applicationsPage.rankedCandidates.statusChangesButton' })[0]
    );

    await waitFor(() => {
      expectLatestHrefQueryValues(mockedReplace, {
        job_id: 'job-1',
        application_id: 'app-1',
        sc_open: '1',
      });
      expect(
        screen.getByText('applicationsPage.statusChanges.focusedApplicationNotVisible')
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'applicationsPage.statusChanges.clearFocusedApplication' })
    );

    await waitFor(() => {
      const latestHref = getLatestMockCallArg<string>(mockedReplace) || '';
      expect(latestHref).toContain('job_id=job-1');
      expect(latestHref).toContain('application_id=app-1');
      expect(latestHref).not.toContain('sc_open=1');
    });
  });

  it('highlights focused status-change row from sc_open deep-link', async () => {
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-2');
    mockedSearchParams.set('sc_open', '1');

    mockedFetchRecentStatusChanges.mockResolvedValue({
      request_id: 'req-status-focused',
      data: {
        job: { id: 'job-1', title: 'Backend Engineer' },
        changes: [
          {
            application_id: 'app-2',
            job: {
              id: 'job-1',
              title: 'Backend Engineer',
            },
            candidate: {
              id: 'c-2',
              full_name: 'Candidate Two',
              email: 'two@example.com',
            },
            from_status: 'screening',
            to_status: 'interview',
            changed_at: '2026-03-25T00:00:00.000Z',
            changed_by: 'recruiter@example.com',
            current_status: 'interview',
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
      },
    });

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(
        screen.getByText('applicationsPage.statusChanges.focusedApplicationVisible')
      ).toBeInTheDocument();
      const focusedStatusRow = document.querySelector('[data-status-change-focused="true"]');
      expect(focusedStatusRow).toBeTruthy();
      expect(focusedStatusRow?.textContent).toContain('Candidate Two');
      expect(screen.getByText('applicationsPage.statusChanges.focusBadge')).toBeInTheDocument();
      expect(mockedScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'applicationsPage.statusChanges.clearFocusedApplication' })
    );

    await waitFor(() => {
      expect(
        screen.queryByText('applicationsPage.statusChanges.focusedApplicationVisible')
      ).not.toBeInTheDocument();
      const focusedStatusRow = document.querySelector('[data-status-change-focused="true"]');
      expect(focusedStatusRow).toBeNull();
      const latestHref = getLatestMockCallArg<string>(mockedReplace) || '';
      expect(latestHref).toContain('job_id=job-1');
      expect(latestHref).toContain('application_id=app-2');
      expect(latestHref).not.toContain('sc_open=1');
    });
  });

  it('auto-seeks focused status-change item on other status-change pages', async () => {
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-target');
    mockedSearchParams.set('sc_open', '1');

    mockedFetchRecentStatusChanges.mockImplementation(async (params) => {
      const page = params?.page || 1;

      if (page === 2) {
        return {
          request_id: 'req-status-focused-page-2',
          data: {
            job: { id: 'job-1', title: 'Backend Engineer' },
            changes: [
              {
                application_id: 'app-target',
                job: {
                  id: 'job-1',
                  title: 'Backend Engineer',
                },
                candidate: {
                  id: 'c-target',
                  full_name: 'Candidate Target',
                  email: 'target@example.com',
                },
                from_status: 'screening',
                to_status: 'interview',
                changed_at: '2026-03-25T00:00:00.000Z',
                changed_by: 'recruiter@example.com',
                current_status: 'interview',
              },
            ],
            pagination: { page: 2, limit: 20, total: 21, total_pages: 2 },
          },
        };
      }

      return {
        request_id: 'req-status-focused-page-1',
        data: {
          job: { id: 'job-1', title: 'Backend Engineer' },
          changes: [
            {
              application_id: 'app-1',
              job: {
                id: 'job-1',
                title: 'Backend Engineer',
              },
              candidate: {
                id: 'c-1',
                full_name: 'Candidate One',
                email: 'one@example.com',
              },
              from_status: 'new',
              to_status: 'screening',
              changed_at: '2026-03-24T00:00:00.000Z',
              changed_by: 'recruiter@example.com',
              current_status: 'screening',
            },
          ],
          pagination: { page: 1, limit: 20, total: 21, total_pages: 2 },
        },
      };
    });

    render(<ApplicationsPage />);

    await waitFor(() => {
      const pageTwoCall = mockedFetchRecentStatusChanges.mock.calls.find((call) => call[0]?.page === 2);
      expect(pageTwoCall).toBeDefined();
      expect(
        screen.getByText('applicationsPage.statusChanges.focusedApplicationVisible')
      ).toBeInTheDocument();
      const focusedStatusRow = document.querySelector('[data-status-change-focused="true"]');
      expect(focusedStatusRow).toBeTruthy();
      expect(focusedStatusRow?.textContent).toContain('Candidate Target');
      expect(screen.getByText('applicationsPage.statusChanges.focusBadge')).toBeInTheDocument();
    });
  });

  it('debounces focused status-change auto-seek when changed-by filter updates rapidly', async () => {
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-target');
    mockedSearchParams.set('sc_open', '1');

    mockedFetchRecentStatusChanges.mockImplementation(async (params) => {
      const page = params?.page || 1;

      if (page === 2) {
        return {
          request_id: 'req-status-focused-debounced-page-2',
          data: {
            job: { id: 'job-1', title: 'Backend Engineer' },
            changes: [
              {
                application_id: 'app-target',
                job: {
                  id: 'job-1',
                  title: 'Backend Engineer',
                },
                candidate: {
                  id: 'c-target',
                  full_name: 'Candidate Target',
                  email: 'target@example.com',
                },
                from_status: 'screening',
                to_status: 'interview',
                changed_at: '2026-03-25T00:00:00.000Z',
                changed_by: params?.changedBy || 'recruiter@example.com',
                current_status: 'interview',
              },
            ],
            pagination: { page: 2, limit: 20, total: 21, total_pages: 2 },
          },
        };
      }

      return {
        request_id: 'req-status-focused-debounced-page-1',
        data: {
          job: { id: 'job-1', title: 'Backend Engineer' },
          changes: [
            {
              application_id: 'app-1',
              job: {
                id: 'job-1',
                title: 'Backend Engineer',
              },
              candidate: {
                id: 'c-1',
                full_name: 'Candidate One',
                email: 'one@example.com',
              },
              from_status: 'new',
              to_status: 'screening',
              changed_at: '2026-03-24T00:00:00.000Z',
              changed_by: 'recruiter@example.com',
              current_status: 'screening',
            },
          ],
          pagination: { page: 1, limit: 20, total: 21, total_pages: 2 },
        },
      };
    });

    vi.useFakeTimers();
    try {
      render(<ApplicationsPage />);
      await vi.advanceTimersByTimeAsync(0);

      fireEvent.change(screen.getByPlaceholderText('applicationsPage.statusChanges.changedByPlaceholder'), {
        target: { value: 'ops-team-a' },
      });
      fireEvent.change(screen.getByPlaceholderText('applicationsPage.statusChanges.changedByPlaceholder'), {
        target: { value: 'ops-team-final' },
      });

      await vi.advanceTimersByTimeAsync(120);
      const earlyPageTwoCalls = mockedFetchRecentStatusChanges.mock.calls.filter(
        (call) => call[0]?.page === 2
      );
      expect(earlyPageTwoCalls).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(220);
      const pageTwoCalls = mockedFetchRecentStatusChanges.mock.calls.filter((call) => call[0]?.page === 2);
      expect(pageTwoCalls).toHaveLength(1);
      expect(pageTwoCalls[0]?.[0]?.changedBy).toBe('ops-team-final');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows return-to-flow action when opened from flow context', async () => {
    mockedSearchParams.set('flow_ctx', '1');

    render(<ApplicationsPage />);

    const returnToFlow = screen.getByText('applicationsPage.returnToFlow').closest('a');
    expect(returnToFlow).toBeTruthy();
    expect(returnToFlow?.getAttribute('href')).toBe('/flow');
  });

  it('returns to flow with focused job and application context', async () => {
    mockedSearchParams.set('flow_ctx', '1');
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-2');

    render(<ApplicationsPage />);

    const returnToFlow = screen.getByText('applicationsPage.returnToFlow').closest('a');
    expect(returnToFlow).toBeTruthy();
    expect(returnToFlow?.getAttribute('href')).toBe(
      '/flow?flow_return_job_id=job-1&flow_return_application_id=app-2'
    );
  });

  it('propagates jobs return snapshot when returning to flow from flow context', async () => {
    mockedSearchParams.set('flow_ctx', '1');
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-2');
    mockedSearchParams.set('jobs_return_query', 'search=Platform+Engineer&status=all&page=2');

    render(<ApplicationsPage />);

    const returnToFlow = screen.getByText('applicationsPage.returnToFlow').closest('a');
    expect(returnToFlow).toBeTruthy();

    const href = returnToFlow?.getAttribute('href') || '';
    const params = new URLSearchParams(href.replace('/flow?', ''));
    const jobsReturn = params.get('jobs_return_query') || '';
    const jobsSnapshot = new URLSearchParams(jobsReturn);
    expect(jobsSnapshot.get('search')).toBe('Platform Engineer');
    expect(jobsSnapshot.get('status')).toBe('all');
    expect(jobsSnapshot.get('page')).toBe('2');
    expect(jobsSnapshot.get('source')).toBe('applications');
  });

  it('preserves valid jobs snapshot source when returning to flow', async () => {
    mockedSearchParams.set('flow_ctx', '1');
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-2');
    mockedSearchParams.set('jobs_return_query', 'search=Platform+Engineer&status=all&page=2&source=flow');

    render(<ApplicationsPage />);

    const returnToFlow = screen.getByText('applicationsPage.returnToFlow').closest('a');
    expect(returnToFlow).toBeTruthy();

    const href = returnToFlow?.getAttribute('href') || '';
    const params = new URLSearchParams(href.replace('/flow?', ''));
    const jobsReturn = params.get('jobs_return_query') || '';
    const jobsSnapshot = new URLSearchParams(jobsReturn);
    expect(jobsSnapshot.get('source')).toBe('flow');
  });

  it('adds fallback status when returning to flow with non-empty jobs snapshot missing status', async () => {
    mockedSearchParams.set('flow_ctx', '1');
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-2');
    mockedSearchParams.set('jobs_return_query', 'search=Platform+Engineer');

    render(<ApplicationsPage />);

    const returnToFlow = screen.getByText('applicationsPage.returnToFlow').closest('a');
    expect(returnToFlow).toBeTruthy();

    const href = returnToFlow?.getAttribute('href') || '';
    const params = new URLSearchParams(href.replace('/flow?', ''));
    const jobsReturn = params.get('jobs_return_query') || '';
    const jobsSnapshot = new URLSearchParams(jobsReturn);
    expect(jobsSnapshot.get('search')).toBe('Platform Engineer');
    expect(jobsSnapshot.get('status')).toBe('all');
    expect(jobsSnapshot.get('source')).toBe('applications');
  });

  it('sanitizes nested return-query keys from jobs snapshot when returning to flow', async () => {
    mockedSearchParams.set('flow_ctx', '1');
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-2');
    mockedSearchParams.set(
      'jobs_return_query',
      'search=Platform+Engineer&status=all&jobs_return_query=page%3D2&applications_return_query=rc_focus%3Dfocus'
    );

    render(<ApplicationsPage />);

    const returnToFlow = screen.getByText('applicationsPage.returnToFlow').closest('a');
    expect(returnToFlow).toBeTruthy();

    const href = returnToFlow?.getAttribute('href') || '';
    const params = new URLSearchParams(href.replace('/flow?', ''));
    const jobsReturn = params.get('jobs_return_query') || '';
    const jobsSnapshot = new URLSearchParams(jobsReturn);
    expect(jobsSnapshot.get('search')).toBe('Platform Engineer');
    expect(jobsSnapshot.get('status')).toBe('all');
    expect(jobsSnapshot.get('jobs_return_query')).toBeNull();
    expect(jobsSnapshot.get('applications_return_query')).toBeNull();
  });

  it('stores active status-history panel in flow return query snapshot', async () => {
    mockedSearchParams.set('flow_ctx', '1');
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-2');
    mockedSearchParams.set('sh_open', '1');

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(mockedFetchApplicationStatusHistory).toHaveBeenCalledWith('app-2');
    });

    const returnToFlow = screen.getByText('applicationsPage.returnToFlow').closest('a');
    expect(returnToFlow).toBeTruthy();

    const href = returnToFlow?.getAttribute('href') || '';
    const flowParams = new URLSearchParams(href.replace('/flow?', ''));
    const snapshot = new URLSearchParams(flowParams.get('flow_return_query') || '');
    expect(snapshot.get('flow_panel')).toBe('status-history');
  });

  it('stores active status-changes panel in flow return query snapshot', async () => {
    mockedSearchParams.set('flow_ctx', '1');
    mockedSearchParams.set('job_id', 'job-1');

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(mockedFetchRankedApplications).toHaveBeenCalled();
      expect(
        screen.getAllByRole('button', {
          name: 'applicationsPage.rankedCandidates.statusChangesButton',
        }).length
      ).toBeGreaterThan(0);
    });

    fireEvent.click(
      screen.getAllByRole('button', { name: 'applicationsPage.rankedCandidates.statusChangesButton' })[0]
    );

    await waitFor(() => {
      expectLatestHrefQueryValues(mockedReplace, {
        job_id: 'job-1',
        application_id: 'app-1',
        sc_open: '1',
      });
    });

    const returnToFlow = screen.getByText('applicationsPage.returnToFlow').closest('a');
    expect(returnToFlow).toBeTruthy();

    const href = returnToFlow?.getAttribute('href') || '';
    const flowParams = new URLSearchParams(href.replace('/flow?', ''));
    expect(flowParams.get('flow_return_job_id')).toBe('job-1');
    expect(flowParams.get('flow_return_application_id')).toBe('app-1');

    const snapshot = new URLSearchParams(flowParams.get('flow_return_query') || '');
    expect(snapshot.get('flow_panel')).toBe('status-changes');
    expect(snapshot.get('sc_open')).toBeNull();
  });

  it('includes sanitized query snapshot in flow return link for round-trip restore', async () => {
    mockedSearchParams.set('flow_ctx', '1');
    mockedSearchParams.set('job_id', 'job-1');
    mockedSearchParams.set('application_id', 'app-2');
    mockedSearchParams.set('rc_focus', 'focus');
    mockedSearchParams.set('rc_changed_by', 'qa-reviewer');
    mockedSearchParams.set('sc_preset', '7d');
    mockedSearchParams.set('fb_open', '1');

    render(<ApplicationsPage />);

    const returnToFlow = screen.getByText('applicationsPage.returnToFlow').closest('a');
    expect(returnToFlow).toBeTruthy();

    const href = returnToFlow?.getAttribute('href') || '';
    expect(href.startsWith('/flow?')).toBe(true);

    const flowParams = new URLSearchParams(href.replace('/flow?', ''));
    expect(flowParams.get('flow_return_job_id')).toBe('job-1');
    expect(flowParams.get('flow_return_application_id')).toBe('app-2');

    const snapshot = new URLSearchParams(flowParams.get('flow_return_query') || '');
    expect(snapshot.get('rc_focus')).toBe('focus');
    expect(snapshot.get('rc_changed_by')).toBe('qa-reviewer');
    expect(snapshot.get('sc_preset')).toBe('7d');
    expect(snapshot.get('job_id')).toBeNull();
    expect(snapshot.get('application_id')).toBeNull();
    expect(snapshot.get('flow_ctx')).toBeNull();
    expect(snapshot.get('fb_open')).toBeNull();
  });

  it('sanitizes invalid status-changes query filters from URL', async () => {
    mockedSearchParams.set('job_id', 'job-invalid-status');
    mockedSearchParams.set('sc_status', 'not-a-status');
    mockedSearchParams.set('sc_preset', 'bad-preset');
    mockedSearchParams.set('sc_page', '0');

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(mockedFetchRecentStatusChanges).toHaveBeenCalled();
      const firstCall = getLatestStatusChangesParams();
      expect(firstCall?.jobId).toBe('job-invalid-status');
      expect(firstCall?.status).toBe('');
      expect(firstCall?.page).toBe(1);
      expect(firstCall?.changedAfter).toBe('');
      expect(firstCall?.changedBefore).toBe('');
    });
  });

  it('applies ranked all-time preset and clears ranked date range', async () => {
    render(<ApplicationsPage />);

    await loadRecruiterAndWaitRanked('job-1');

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.recruiterView.preset.7d' }));

    await waitFor(() => {
      const latest = getLatestRankedParams();
      expect(latest?.changedAfter).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(latest?.changedBefore).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.recruiterView.preset.all-time' }));

    await waitFor(() => {
      const latest = getLatestRankedParams();
      expect(latest?.changedAfter).toBe('');
      expect(latest?.changedBefore).toBe('');
    });
  });

  it('shows and clears ranked active filter chips', async () => {
    render(<ApplicationsPage />);

    fireEvent.change(screen.getByPlaceholderText('applicationsPage.recruiterView.jobIdPlaceholder'), {
      target: { value: 'job-1' },
    });
    fireEvent.change(screen.getByPlaceholderText('applicationsPage.recruiterView.changedByFilterPlaceholder'), {
      target: { value: 'qa-reviewer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.recruiterView.preset.7d' }));

    await waitFor(() => {
      expect(screen.getByText('applicationsPage.recruiterView.activeFiltersLabel')).toBeInTheDocument();
      expect(screen.getByText('applicationsPage.recruiterView.summaryChangedBy')).toBeInTheDocument();
      expect(screen.getAllByText('applicationsPage.recruiterView.preset.7d').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.recruiterView.clearSummaryButton' }));

    await waitFor(() => {
      const calls = mockedFetchRankedApplications.mock.calls;
      const latest = calls[calls.length - 1]?.[0];
      expect(latest?.changedBy).toBe('');
      expect(latest?.changedAfter).toBe('');
      expect(latest?.changedBefore).toBe('');
      expect(latest?.page).toBe(1);
    });
  });

  it('hydrates status changes filters from query string on initial load', async () => {
    mockedSearchParams.set('job_id', 'job-2');
    mockedSearchParams.set('sc_status', 'interview');
    mockedSearchParams.set('sc_changed_by', 'recruiter-ui');
    mockedSearchParams.set('sc_after', '2026-03-01');
    mockedSearchParams.set('sc_before', '2026-03-23');
    mockedSearchParams.set('sc_page', '2');

    render(<ApplicationsPage />);

    await waitFor(() => {
      expect(mockedFetchRecentStatusChanges).toHaveBeenCalled();
      const firstCall = mockedFetchRecentStatusChanges.mock.calls[0]?.[0];
      expect(firstCall?.jobId).toBe('job-2');
      expect(firstCall?.status).toBe('interview');
      expect(firstCall?.changedBy).toBe('recruiter-ui');
      expect(firstCall?.changedAfter).toBe('2026-03-01');
      expect(firstCall?.changedBefore).toBe('2026-03-23');
      expect(firstCall?.page).toBe(2);
    });
  });

  it('syncs status changes filters to query string for shareable URL', async () => {
    render(<ApplicationsPage />);

    await loadRecruiterAndWaitStatusChanges('job-1');

    fireEvent.change(screen.getByPlaceholderText('applicationsPage.statusChanges.changedByPlaceholder'), {
      target: { value: 'recruiter-ui' },
    });

    await waitFor(() => {
      const presetButton = screen.getByRole('button', {
        name: 'applicationsPage.statusChanges.preset.7d',
      });
      expect(presetButton).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.statusChanges.preset.7d' }));

    await waitFor(() => {
      expectLatestHrefContains(mockedReplace, ['/applications?']);
      expectLatestHrefQueryValues(mockedReplace, {
        job_id: 'job-1',
        sc_changed_by: 'recruiter-ui',
        sc_preset: '7d',
      });
      expectLatestHrefHasQueryKeys(mockedReplace, ['sc_after', 'sc_before']);
    });
  });

  it('exports status changes CSV using current filters', async () => {
    render(<ApplicationsPage />);

    await loadRecruiterAndWaitStatusChanges('job-1');

    fireEvent.change(screen.getByPlaceholderText('applicationsPage.statusChanges.changedByPlaceholder'), {
      target: { value: 'recruiter-ui' },
    });
    fireEvent.change(screen.getAllByRole('combobox')[1], {
      target: { value: 'screening' },
    });

    await waitFor(() => {
      const exportButton = screen.getByRole('button', {
        name: 'applicationsPage.statusChanges.exportButton',
      });
      expect(exportButton).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.statusChanges.exportButton' }));

    await waitFor(() => {
      expect(mockedExportRecentStatusChangesCsv).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-1',
          status: 'screening',
          changedBy: 'recruiter-ui',
        })
      );
      expect(mockedDownloadBlobAsFile).toHaveBeenCalledWith(
        expect.any(Blob),
        expect.stringMatching(/^status_changes_job-1_\d{4}-\d{2}-\d{2}\.csv$/)
      );
    });
  });

  it.each([
    {
      preset: '7d',
      expectedAfter: /^\d{4}-\d{2}-\d{2}$/,
      expectedBefore: /^\d{4}-\d{2}-\d{2}$/,
    },
    {
      preset: 'this-month',
      expectedAfter: /^\d{4}-\d{2}-01$/,
      expectedBefore: /^\d{4}-\d{2}-\d{2}$/,
    },
    {
      preset: 'ytd',
      expectedAfter: /^\d{4}-01-01$/,
      expectedBefore: /^\d{4}-\d{2}-\d{2}$/,
    },
    {
      preset: 'all-time',
      expectedAfter: '',
      expectedBefore: '',
    },
  ])(
    'applies quick $preset preset for status changes filters',
    async ({ preset, expectedAfter, expectedBefore }) => {
      render(<ApplicationsPage />);

      await loadRecruiterAndWaitStatusChanges('job-1');

      fireEvent.click(screen.getByRole('button', { name: `applicationsPage.statusChanges.preset.${preset}` }));

      await waitFor(() => {
        const latest = getLatestStatusChangesParams();
        expect(latest?.jobId).toBe('job-1');

        if (typeof expectedAfter === 'string') {
          expect(latest?.changedAfter).toBe(expectedAfter);
        } else {
          expect(latest?.changedAfter).toMatch(expectedAfter);
        }

        if (typeof expectedBefore === 'string') {
          expect(latest?.changedBefore).toBe(expectedBefore);
        } else {
          expect(latest?.changedBefore).toMatch(expectedBefore);
        }
      });
    }
  );

  it('toggles active preset style when switching from 7d to quarter-to-date', async () => {
    render(<ApplicationsPage />);

    await loadRecruiterAndWaitStatusChanges('job-1');

    const preset7d = screen.getByRole('button', { name: 'applicationsPage.statusChanges.preset.7d' });
    const presetQtd = screen.getByRole('button', { name: 'applicationsPage.statusChanges.preset.qtd' });

    fireEvent.click(preset7d);
    await waitFor(() => {
      expect(preset7d.className).toContain('bg-blue-50');
    });

    fireEvent.click(presetQtd);
    await waitFor(() => {
      expect(presetQtd.className).toContain('bg-blue-50');
      expect(preset7d.className).not.toContain('bg-blue-50');
    });

    await waitFor(() => {
      const latest = getLatestStatusChangesParams();
      expect(latest?.jobId).toBe('job-1');
      expect(latest?.changedAfter).toMatch(/^\d{4}-(01|04|07|10)-01$/);
      expect(latest?.changedBefore).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });


  it('shows active filter summary chips for status and changedBy filters', async () => {
    render(<ApplicationsPage />);

    fireEvent.change(screen.getByPlaceholderText('applicationsPage.recruiterView.jobIdPlaceholder'), {
      target: { value: 'job-1' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'applicationsPage.load' })[0]);

    await waitFor(() => {
      expect(mockedFetchRecentStatusChanges).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByPlaceholderText('applicationsPage.statusChanges.changedByPlaceholder'), {
      target: { value: 'recruiter-ui' },
    });

    fireEvent.change(screen.getAllByRole('combobox')[1], {
      target: { value: 'screening' },
    });

    await waitFor(() => {
      expect(screen.getByText('applicationsPage.statusChanges.activeFiltersLabel')).toBeInTheDocument();
      expect(screen.getByText('applicationsPage.statusChanges.summaryChangedBy')).toBeInTheDocument();
      expect(screen.getByText('applicationsPage.statusChanges.summaryStatus')).toBeInTheDocument();
    });
  });

  it('removes status filter when clicking its summary chip', async () => {
    render(<ApplicationsPage />);

    fireEvent.change(screen.getByPlaceholderText('applicationsPage.recruiterView.jobIdPlaceholder'), {
      target: { value: 'job-1' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'applicationsPage.load' })[0]);

    await waitFor(() => {
      expect(mockedFetchRecentStatusChanges).toHaveBeenCalled();
    });

    fireEvent.change(screen.getAllByRole('combobox')[1], {
      target: { value: 'screening' },
    });

    await waitFor(() => {
      expect(screen.getByText('applicationsPage.statusChanges.summaryStatus')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('applicationsPage.statusChanges.summaryStatus'));

    await waitFor(() => {
      const calls = mockedFetchRecentStatusChanges.mock.calls;
      const latest = calls[calls.length - 1]?.[0];
      expect(latest?.status).toBe('');
    });
  });

  it('clears all active summary chips via clear chips action', async () => {
    render(<ApplicationsPage />);

    fireEvent.change(screen.getByPlaceholderText('applicationsPage.recruiterView.jobIdPlaceholder'), {
      target: { value: 'job-1' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'applicationsPage.load' })[0]);

    await waitFor(() => {
      expect(mockedFetchRecentStatusChanges).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByPlaceholderText('applicationsPage.statusChanges.changedByPlaceholder'), {
      target: { value: 'recruiter-ui' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.statusChanges.preset.7d' }));

    await waitFor(() => {
      expect(screen.getByText('applicationsPage.statusChanges.summaryChangedBy')).toBeInTheDocument();
      expect(screen.getByText('applicationsPage.statusChanges.preset.7d')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.statusChanges.clearSummaryButton' }));

    await waitFor(() => {
      const calls = mockedFetchRecentStatusChanges.mock.calls;
      const latest = calls[calls.length - 1]?.[0];
      expect(latest?.status).toBe('');
      expect(latest?.changedBy).toBe('');
      expect(latest?.changedAfter).toBe('');
      expect(latest?.changedBefore).toBe('');
      expect(latest?.page).toBe(1);
    });
  });

  it('clears all status change filters when clicking clear filters', async () => {
    render(<ApplicationsPage />);

    await loadRecruiterAndWaitStatusChanges('job-1');

    fireEvent.change(screen.getByPlaceholderText('applicationsPage.statusChanges.changedByPlaceholder'), {
      target: { value: 'recruiter' },
    });
    fireEvent.change(screen.getByLabelText('applicationsPage.statusChanges.changedAfterLabel'), {
      target: { value: '2026-03-01' },
    });
    fireEvent.change(screen.getByLabelText('applicationsPage.statusChanges.changedBeforeLabel'), {
      target: { value: '2026-03-23' },
    });

    await waitFor(() => {
      const calls = mockedFetchRecentStatusChanges.mock.calls.map((call) => call[0]);
      const presetCall = calls.find(
        (params) =>
          params?.changedBy === 'recruiter' &&
          params?.changedAfter === '2026-03-01' &&
          params?.changedBefore === '2026-03-23'
      );
      expect(presetCall).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.statusChanges.clearFiltersButton' }));

    await waitFor(() => {
      const latest = getLatestStatusChangesParams();
      expect(latest?.status).toBe('');
      expect(latest?.changedBy).toBe('');
      expect(latest?.changedAfter).toBe('');
      expect(latest?.changedBefore).toBe('');
      expect(latest?.page).toBe(1);
    });
  });
});
