import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMutableSearchParams } from './utils/search-params';

const mockedPush = vi.fn();
const mockedReplace = vi.fn();
const searchParamsHarness = createMutableSearchParams();
const mockedSearchParams = searchParamsHarness.params;
const mockedAuthUser: { id: string; role: 'candidate' | 'recruiter' | 'admin' } = {
  id: 'candidate-1',
  role: 'candidate',
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockedPush, replace: mockedReplace }),
  usePathname: () => '/jobs',
  useSearchParams: () => mockedSearchParams,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
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

vi.mock('@/lib/api/jobs', () => ({
  closeJob: vi.fn(),
  deleteJob: vi.fn(),
  fetchJobs: vi.fn(),
  reopenJob: vi.fn(),
  updateJob: vi.fn(),
}));

vi.mock('@/lib/api/resume', () => ({
  fetchResumeList: vi.fn(),
}));

vi.mock('@/lib/api/applications', () => ({
  createApplication: vi.fn(),
}));

vi.mock('@/lib/api/config', () => ({
  fetchCompanyProfileConfig: vi.fn(),
}));

import JobsPage from '@/app/(default)/jobs/page';
import { fetchJobs } from '@/lib/api/jobs';
import { fetchResumeList } from '@/lib/api/resume';
import { createApplication } from '@/lib/api/applications';
import { fetchCompanyProfileConfig } from '@/lib/api/config';

const mockedFetchJobs = vi.mocked(fetchJobs);
const mockedFetchResumeList = vi.mocked(fetchResumeList);
const mockedCreateApplication = vi.mocked(createApplication);
const mockedFetchCompanyProfileConfig = vi.mocked(fetchCompanyProfileConfig);

describe('JobsPage candidate apply redirects', () => {
  beforeEach(() => {
    searchParamsHarness.reset();
    mockedPush.mockReset();
    mockedReplace.mockReset();
    mockedFetchJobs.mockReset();
    mockedFetchResumeList.mockReset();
    mockedCreateApplication.mockReset();
    mockedFetchCompanyProfileConfig.mockReset();
    mockedAuthUser.id = 'candidate-1';
    mockedAuthUser.role = 'candidate';

    mockedFetchResumeList.mockResolvedValue([
      {
        resume_id: 'resume-master-1',
        is_master: true,
        candidate_id: 'candidate-1',
      },
    ] as never);

    mockedFetchJobs.mockResolvedValue({
      data: [
        {
          _id: 'job-1',
          recruiterId: 'rec-1',
          title: 'Backend Engineer',
          description: 'Own backend APIs and production reliability.',
          requirements: 'Node.js, MongoDB, observability',
          benefits: 'Remote',
          applicationDeadline: null,
          cleanText: 'Backend Engineer Node Mongo',
          qdrantId: null,
          isAnalyzed: true,
          keywords: ['node', 'mongodb'],
          category: 'IT',
          location: 'Remote',
          experienceLevel: 'Senior',
          status: 'active',
          importantChangeHistory: [],
          applications_count: 0,
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z',
        },
      ],
      pagination: {
        page: 1,
        limit: 12,
        total: 1,
        totalPages: 1,
      },
    });

    mockedCreateApplication.mockResolvedValue({
      request_id: 'req-apply',
      data: {
        application_id: 'app-1',
      },
    });

    mockedFetchCompanyProfileConfig.mockResolvedValue({
      company_name: '',
      overview: '',
      industry: '',
      company_size: '',
      address: '',
      website: '',
      brand_primary_color: '#1D4ED8',
      brand_logo_url: '',
    });

    localStorage.clear();
  });

  it('hydrates focused job context from query params and applies deep-link filters', async () => {
    mockedSearchParams.set('focus_job_id', 'job-1');
    mockedSearchParams.set('search', 'Backend Engineer');
    mockedSearchParams.set('status', 'all');

    render(<JobsPage />);

    await waitFor(() => {
      expect(mockedFetchJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Backend Engineer',
          status: '',
          page: 1,
          limit: 12,
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('jobsPage.focusedJobVisible')).toBeInTheDocument();
      expect(screen.getByText('jobsPage.focusBadge')).toBeInTheDocument();
    });
  });

  it('syncs filter/page changes to shareable jobs query string', async () => {
    mockedFetchJobs.mockResolvedValue({
      data: [
        {
          _id: 'job-1',
          recruiterId: 'rec-1',
          title: 'Backend Engineer',
          description: 'Own backend APIs and production reliability.',
          requirements: 'Node.js, MongoDB, observability',
          benefits: 'Remote',
          applicationDeadline: null,
          cleanText: 'Backend Engineer Node Mongo',
          qdrantId: null,
          isAnalyzed: true,
          keywords: ['node', 'mongodb'],
          category: 'IT',
          location: 'Remote',
          experienceLevel: 'Senior',
          status: 'active',
          importantChangeHistory: [],
          applications_count: 0,
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z',
        },
      ],
      pagination: {
        page: 1,
        limit: 12,
        total: 13,
        totalPages: 2,
      },
    });

    render(<JobsPage />);

    const searchInput = screen.getByPlaceholderText('common.search');
    fireEvent.change(searchInput, { target: { value: 'Platform Engineer' } });

    await waitFor(() => {
      const calls = mockedReplace.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const latestHref = String(calls[calls.length - 1]?.[0] || '');
      expect(latestHref).toContain('/jobs?');
      expect(latestHref).toContain('search=Platform+Engineer');
    });

    fireEvent.click(screen.getByRole('button', { name: 'jobsPage.next' }));

    await waitFor(() => {
      const calls = mockedReplace.mock.calls;
      const latestHref = String(calls[calls.length - 1]?.[0] || '');
      expect(latestHref).toContain('page=2');
    });
  });

  it('clears focus_job_id and source from URL when focused job is cleared', async () => {
    mockedSearchParams.set('focus_job_id', 'job-1');
    mockedSearchParams.set('search', 'Backend Engineer');
    mockedSearchParams.set('status', 'all');
    mockedSearchParams.set('source', 'applications');

    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByText('jobsPage.focusedJobVisible')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'jobsPage.clearFocusedJob' }));

    await waitFor(() => {
      const calls = mockedReplace.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const latestHref = String(calls[calls.length - 1]?.[0] || '');
      expect(latestHref).not.toContain('focus_job_id=job-1');
      expect(latestHref).not.toContain('source=applications');
      expect(latestHref).toContain('search=Backend+Engineer');
      expect(latestHref).toContain('status=all');
    });
  });

  it('renders company profile banner when config is available', async () => {
    mockedFetchCompanyProfileConfig.mockResolvedValue({
      company_name: 'Acme Corp',
      overview: 'Global hiring platform for high growth teams.',
      industry: 'Software',
      company_size: '51-200',
      address: 'Ho Chi Minh City',
      website: 'https://acme.example',
      brand_primary_color: '#FF5500',
      brand_logo_url: 'https://acme.example/logo.png',
    });

    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByText('jobsPage.companyProfileLabel')).toBeInTheDocument();
    });

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText(/jobsPage\.companyProfileIndustry/i)).toBeInTheDocument();
    expect(screen.getByText(/Software/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /acme\.example/i })).toBeInTheDocument();
    expect(screen.getByAltText('Acme Corp logo')).toBeInTheDocument();
  });

  it('returns to applications with preserved query snapshot from focused banner', async () => {
    mockedSearchParams.set('focus_job_id', 'job-1');
    mockedSearchParams.set('source', 'applications');
    mockedSearchParams.set(
      'applications_return_query',
      'candidate_id=candidate-1&rc_changed_by=qa-reviewer&sc_preset=7d'
    );

    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'jobsPage.backToApplications' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'jobsPage.backToApplications' }));

    expect(mockedPush).toHaveBeenCalledWith(
      '/applications?candidate_id=candidate-1&rc_changed_by=qa-reviewer&sc_preset=7d'
    );
  });

  it('sanitizes recursive context keys from applications snapshot on focused banner return', async () => {
    mockedSearchParams.set('focus_job_id', 'job-1');
    mockedSearchParams.set('source', 'applications');
    mockedSearchParams.set(
      'applications_return_query',
      'candidate_id=candidate-1&application_id=app-2&rc_changed_by=qa-reviewer&source=applications&flow_ctx=1&jobs_return_query=search%3Dbackend&applications_return_query=sc_preset%253D7d'
    );

    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'jobsPage.backToApplications' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'jobsPage.backToApplications' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/applications?')).toBe(true);

    const params = new URLSearchParams(href.replace('/applications?', ''));
    expect(params.get('candidate_id')).toBe('candidate-1');
    expect(params.get('application_id')).toBe('app-2');
    expect(params.get('rc_changed_by')).toBe('qa-reviewer');
    expect(params.get('source')).toBeNull();
    expect(params.get('flow_ctx')).toBeNull();
    expect(params.get('jobs_return_query')).toBeNull();
    expect(params.get('applications_return_query')).toBeNull();
  });

  it('drops stale applications return snapshot when source is not applications', async () => {
    mockedSearchParams.set('focus_job_id', 'job-1');
    mockedSearchParams.set('source', 'flow');
    mockedSearchParams.set(
      'applications_return_query',
      'candidate_id=candidate-1&rc_changed_by=qa-reviewer&sc_preset=7d'
    );

    render(<JobsPage />);

    await waitFor(() => {
      const calls = mockedReplace.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const latestHref = String(calls[calls.length - 1]?.[0] || '');
      expect(latestHref).toContain('/jobs?');
      expect(latestHref).toContain('source=flow');
      expect(latestHref).not.toContain('applications_return_query=');
    });
  });

  it('returns to flow with focused job and jobs snapshot when opened from flow context', async () => {
    mockedSearchParams.set('focus_job_id', 'job-1');
    mockedSearchParams.set('search', 'Backend Engineer');
    mockedSearchParams.set('status', 'all');
    mockedSearchParams.set('source', 'flow');

    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'applicationsPage.returnToFlow' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'applicationsPage.returnToFlow' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/flow?')).toBe(true);

    const params = new URLSearchParams(href.replace('/flow?', ''));
    expect(params.get('flow_return_job_id')).toBe('job-1');

    const returnQuery = params.get('jobs_return_query') || '';
    const snapshot = new URLSearchParams(returnQuery);
    expect(snapshot.get('focus_job_id')).toBe('job-1');
    expect(snapshot.get('search')).toBe('Backend Engineer');
    expect(snapshot.get('status')).toBe('all');
    expect(snapshot.get('source')).toBe('flow');
  });

  it('opens focused job in flow from focused banner with return snapshot', async () => {
    mockedSearchParams.set('focus_job_id', 'job-1');
    mockedSearchParams.set('search', 'Backend Engineer');
    mockedSearchParams.set('status', 'all');
    mockedSearchParams.set('source', 'applications');

    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'jobsPage.openFocusedInFlow' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'jobsPage.openFocusedInFlow' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/flow?')).toBe(true);

    const params = new URLSearchParams(href.replace('/flow?', ''));
    expect(params.get('prefill_job')).toBe('1');
    expect(params.get('focused_job')).toBe('1');

    const returnQuery = params.get('jobs_return_query') || '';
    const snapshot = new URLSearchParams(returnQuery);
    expect(snapshot.get('focus_job_id')).toBe('job-1');
    expect(snapshot.get('source')).toBe('applications');
  });

  it('redirects candidate apply success to candidate history with focused application', async () => {
    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'jobsPage.applyWithMaster' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'jobsPage.applyWithMaster' }));

    await waitFor(() => {
      expect(mockedCreateApplication).toHaveBeenCalledWith({
        job_id: 'job-1',
        resume_id: 'resume-master-1',
      });
      expect(screen.getByText('jobsPage.submittedRedirecting')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockedPush).toHaveBeenCalledWith(
        '/applications?candidate_id=candidate-1&application_id=app-1&candidate_focus=1'
      );
    }, { timeout: 2000 });
  });

  it('redirects duplicate apply to candidate history without focused application context', async () => {
    mockedCreateApplication.mockRejectedValueOnce(new Error('409 conflict'));

    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'jobsPage.applyWithMaster' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'jobsPage.applyWithMaster' }));

    await waitFor(() => {
      expect(screen.getByText('jobsPage.duplicateRedirecting')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockedPush).toHaveBeenCalledWith('/applications?candidate_id=candidate-1');
    }, { timeout: 2000 });
  });

  it('includes jobs snapshot query when redirecting candidate apply success to applications', async () => {
    mockedSearchParams.set('search', 'Platform Engineer');
    mockedSearchParams.set('status', 'all');
    mockedSearchParams.set('page', '2');
    mockedSearchParams.set('location', 'Remote');

    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'jobsPage.applyWithMaster' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'jobsPage.applyWithMaster' }));

    await waitFor(() => {
      const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
      expect(href.startsWith('/applications?')).toBe(true);

      const params = new URLSearchParams(href.replace('/applications?', ''));
      expect(params.get('candidate_id')).toBe('candidate-1');
      expect(params.get('application_id')).toBe('app-1');
      expect(params.get('candidate_focus')).toBe('1');

      const returnQuery = params.get('jobs_return_query') || '';
      const snapshot = new URLSearchParams(returnQuery);
      expect(snapshot.get('search')).toBe('Platform Engineer');
      expect(snapshot.get('status')).toBe('all');
      expect(snapshot.get('page')).toBe('2');
      expect(snapshot.get('location')).toBe('Remote');
      expect(snapshot.get('source')).toBe('applications');
    }, { timeout: 2000 });
  });

  it('stores selected job context and opens flow for tailor-and-apply path', async () => {
    mockedSearchParams.set('search', 'Backend Engineer');
    mockedSearchParams.set('status', 'all');
    mockedSearchParams.set('source', 'applications');

    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'jobsPage.tailorAndApply' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'jobsPage.tailorAndApply' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/flow?')).toBe(true);

    const params = new URLSearchParams(href.replace('/flow?', ''));
    expect(params.get('prefill_job')).toBe('1');

    const returnQuery = params.get('jobs_return_query') || '';
    const snapshot = new URLSearchParams(returnQuery);
    expect(snapshot.get('search')).toBe('Backend Engineer');
    expect(snapshot.get('status')).toBe('all');
    expect(snapshot.get('source')).toBe('applications');

    const stored = localStorage.getItem('flow_prefill_job_v1');
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored || '{}') as {
      jobId?: string;
      source?: string;
      jobDescription?: string;
    };
    expect(parsed.jobId).toBe('job-1');
    expect(parsed.source).toBe('jobs');
    expect(parsed.jobDescription).toContain('backend APIs');
  });

  it('normalizes missing jobs snapshot source to flow for tailor-and-apply path', async () => {
    mockedSearchParams.set('search', 'Platform Engineer');
    mockedSearchParams.set('status', 'all');
    mockedSearchParams.set('jobs_return_query', 'page=2');

    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'jobsPage.tailorAndApply' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'jobsPage.tailorAndApply' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/flow?')).toBe(true);

    const params = new URLSearchParams(href.replace('/flow?', ''));
    const returnQuery = params.get('jobs_return_query') || '';
    const snapshot = new URLSearchParams(returnQuery);
    expect(snapshot.get('search')).toBe('Platform Engineer');
    expect(snapshot.get('status')).toBe('all');
    expect(snapshot.get('source')).toBe('flow');
    expect(snapshot.get('jobs_return_query')).toBeNull();
  });

  it('preserves applications snapshot on recruiter ranked-candidates entry when source is applications', async () => {
    mockedAuthUser.id = 'recruiter-1';
    mockedAuthUser.role = 'recruiter';
    mockedSearchParams.set('source', 'applications');
    mockedSearchParams.set(
      'applications_return_query',
      'candidate_id=candidate-1&candidate_focus=1&application_id=app-99&rc_changed_by=qa-reviewer&sc_preset=7d'
    );

    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByText('jobsPage.viewRankedCandidates')).toBeInTheDocument();
    });

    const href = screen.getByText('jobsPage.viewRankedCandidates').closest('a')?.getAttribute('href') || '';
    expect(href.startsWith('/applications?')).toBe(true);

    const params = new URLSearchParams(href.replace('/applications?', ''));
    expect(params.get('job_id')).toBe('job-1');
    expect(params.get('rc_changed_by')).toBe('qa-reviewer');
    expect(params.get('sc_preset')).toBe('7d');
    expect(params.get('candidate_id')).toBeNull();
    expect(params.get('candidate_focus')).toBeNull();
    expect(params.get('application_id')).toBeNull();

    const returnQuery = params.get('jobs_return_query') || '';
    const snapshot = new URLSearchParams(returnQuery);
    expect(snapshot.get('source')).toBe('applications');
  });

  it('includes jobs snapshot on recruiter ranked-candidates entry in default jobs context', async () => {
    mockedAuthUser.id = 'recruiter-1';
    mockedAuthUser.role = 'recruiter';
    mockedSearchParams.set('search', 'Platform Engineer');
    mockedSearchParams.set('status', 'all');
    mockedSearchParams.set('page', '3');
    mockedSearchParams.set('location', 'Remote');

    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByText('jobsPage.viewRankedCandidates')).toBeInTheDocument();
    });

    const href = screen.getByText('jobsPage.viewRankedCandidates').closest('a')?.getAttribute('href') || '';
    const params = new URLSearchParams(href.replace('/applications?', ''));
    expect(params.get('job_id')).toBe('job-1');

    const returnQuery = params.get('jobs_return_query') || '';
    const snapshot = new URLSearchParams(returnQuery);
    expect(snapshot.get('search')).toBe('Platform Engineer');
    expect(snapshot.get('status')).toBe('all');
    expect(snapshot.get('page')).toBe('3');
    expect(snapshot.get('location')).toBe('Remote');
    expect(snapshot.get('source')).toBe('applications');
  });

  it('adds fallback status to jobs snapshot when recruiter opens ranked candidates without status query', async () => {
    mockedAuthUser.id = 'recruiter-1';
    mockedAuthUser.role = 'recruiter';
    mockedSearchParams.set('search', 'Platform Engineer');

    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByText('jobsPage.viewRankedCandidates')).toBeInTheDocument();
    });

    const href = screen.getByText('jobsPage.viewRankedCandidates').closest('a')?.getAttribute('href') || '';
    const params = new URLSearchParams(href.replace('/applications?', ''));
    expect(params.get('job_id')).toBe('job-1');

    const returnQuery = params.get('jobs_return_query') || '';
    const snapshot = new URLSearchParams(returnQuery);
    expect(snapshot.get('search')).toBe('Platform Engineer');
    expect(snapshot.get('status')).toBe('all');
    expect(snapshot.get('source')).toBe('applications');
  });
});
