import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockedReplace = vi.fn();
const mockedSearchParams = new URLSearchParams();
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

function resetMockedSearchParams() {
  const keys = Array.from(mockedSearchParams.keys());
  for (const key of keys) {
    mockedSearchParams.delete(key);
  }
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
  useRouter: () => ({ replace: mockedReplace }),
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

vi.mock('@/lib/utils/download', () => ({
  downloadBlobAsFile: vi.fn(),
}));

import ApplicationsPage from '@/app/(default)/applications/page';
import {
  bulkUpdateApplicationStatus,
  exportRecentStatusChangesCsv,
  fetchApplicationStatusSummary,
  fetchCandidateApplicationHistory,
  fetchRankedApplications,
  fetchRecentStatusChanges,
} from '@/lib/api/applications';
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
const mockedBulkUpdateApplicationStatus = vi.mocked(bulkUpdateApplicationStatus);
const mockedExportRecentStatusChangesCsv = vi.mocked(exportRecentStatusChangesCsv);
const mockedDownloadBlobAsFile = vi.mocked(downloadBlobAsFile);

describe('ApplicationsPage status changes filters', () => {
  beforeEach(() => {
    mockedAuthUser.id = 'recruiter-1';
    mockedAuthUser.role = 'recruiter';
    resetMockedSearchParams();
    mockedReplace.mockReset();
    mockedFetchRankedApplications.mockReset();
    mockedFetchApplicationStatusSummary.mockReset();
    mockedFetchCandidateApplicationHistory.mockReset();
    mockedFetchRecentStatusChanges.mockReset();
    mockedBulkUpdateApplicationStatus.mockReset();
    mockedExportRecentStatusChangesCsv.mockReset();
    mockedDownloadBlobAsFile.mockReset();

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
