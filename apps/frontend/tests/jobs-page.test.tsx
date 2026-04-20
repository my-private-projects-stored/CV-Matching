import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const mockedPush = vi.fn();
const mockedAuthUser: { id: string; role: 'candidate' | 'recruiter' | 'admin' } = {
  id: 'candidate-1',
  role: 'candidate',
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockedPush }),
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

import JobsPage from '@/app/(default)/jobs/page';
import { fetchJobs } from '@/lib/api/jobs';
import { fetchResumeList } from '@/lib/api/resume';
import { createApplication } from '@/lib/api/applications';

const mockedFetchJobs = vi.mocked(fetchJobs);
const mockedFetchResumeList = vi.mocked(fetchResumeList);
const mockedCreateApplication = vi.mocked(createApplication);

describe('JobsPage candidate apply redirects', () => {
  beforeEach(() => {
    mockedPush.mockReset();
    mockedFetchJobs.mockReset();
    mockedFetchResumeList.mockReset();
    mockedCreateApplication.mockReset();

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

    localStorage.clear();
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
});
