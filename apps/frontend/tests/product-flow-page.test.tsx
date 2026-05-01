import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMutableSearchParams } from './utils/search-params';

const mockedPush = vi.fn();
const searchParamsHarness = createMutableSearchParams();
const mockedSearchParams = searchParamsHarness.params;
const mockedUploadJobDescriptions = vi.fn();
const mockedPreviewImproveResume = vi.fn();
const mockedConfirmImproveResume = vi.fn();
const mockedGetResumePdfUrl = vi.fn();
const mockedCreateApplication = vi.fn();
const mockedWindowOpen = vi.fn();
const mockedScrollIntoView = vi.fn();
const mockedAuthUser: { id: string; role: 'candidate' | 'recruiter' | 'admin' } = {
  id: 'recruiter-1',
  role: 'recruiter',
};

vi.mock('@/lib/utils/download', () => ({
  downloadBlobAsFile: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockedPush }),
  useSearchParams: () => mockedSearchParams,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (!params) return key;
      return `${key}:${Object.values(params).join('|')}`;
    },
  }),
}));

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({
    user: mockedAuthUser,
  }),
}));

vi.mock('@/components/dashboard/resume-upload-dialog', () => ({
  ResumeUploadDialog: ({ onUploadComplete }: { onUploadComplete?: (resumeId: string) => void }) => (
    <button
      type="button"
      onClick={() => {
        onUploadComplete?.('resume-master-1');
      }}
    >
      mock-upload
    </button>
  ),
}));

vi.mock('@/lib/api/resume', () => ({
  uploadJobDescriptions: (...args: unknown[]) => mockedUploadJobDescriptions(...args),
  previewImproveResume: (...args: unknown[]) => mockedPreviewImproveResume(...args),
  confirmImproveResume: (...args: unknown[]) => mockedConfirmImproveResume(...args),
  getResumePdfUrl: (...args: unknown[]) => mockedGetResumePdfUrl(...args),
}));

vi.mock('@/lib/api/applications', () => ({
  createApplication: (...args: unknown[]) => mockedCreateApplication(...args),
}));

vi.mock('@/lib/utils/logger', () => ({
  logError: vi.fn(),
}));

import ProductFlowPage from '@/app/(default)/flow/page';
import { downloadBlobAsFile } from '@/lib/utils/download';

const mockedDownloadBlobAsFile = vi.mocked(downloadBlobAsFile);

describe('ProductFlowPage', () => {
  beforeEach(() => {
    searchParamsHarness.reset();
    mockedAuthUser.id = 'recruiter-1';
    mockedAuthUser.role = 'recruiter';
    mockedPush.mockReset();
    mockedUploadJobDescriptions.mockReset();
    mockedPreviewImproveResume.mockReset();
    mockedConfirmImproveResume.mockReset();
    mockedGetResumePdfUrl.mockReset();
    mockedCreateApplication.mockReset();
    mockedWindowOpen.mockReset();
    mockedScrollIntoView.mockReset();
    mockedDownloadBlobAsFile.mockReset();

    mockedUploadJobDescriptions.mockResolvedValue('job-1');
    mockedPreviewImproveResume.mockResolvedValue({
      data: {
        job_id: 'job-1',
        resume_preview: { personalInfo: { name: 'Candidate' } },
        improvements: [{ suggestion: 'improve', lineNumber: 1 }],
        diff_summary: { total_changes: 2 },
      },
    });
    mockedConfirmImproveResume.mockResolvedValue({
      data: {
        resume_id: 'tailored-1',
      },
    });
    mockedGetResumePdfUrl.mockReturnValue('http://localhost:3001/api/resumes/tailored-1/pdf');
    mockedCreateApplication.mockResolvedValue({
      data: {
        application_id: 'app-1',
      },
    });

    vi.stubGlobal('open', mockedWindowOpen);
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      value: mockedScrollIntoView,
      writable: true,
      configurable: true,
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs generate preview flow after upload', async () => {
    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'mock-upload' }));

    const textarea = screen.getByPlaceholderText('flow.sections.jobDescriptionPlaceholder');
    fireEvent.change(textarea, {
      target: {
        value:
          'Senior backend role requiring Node.js, MongoDB, observability, Docker, and API quality ownership.',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.generatePreview' }));

    await waitFor(() => {
      expect(mockedUploadJobDescriptions).toHaveBeenCalledWith(
        [
          'Senior backend role requiring Node.js, MongoDB, observability, Docker, and API quality ownership.',
        ],
        'resume-master-1'
      );
    });

    await waitFor(() => {
      expect(mockedPreviewImproveResume).toHaveBeenCalledWith('resume-master-1', 'job-1');
    });
  });

  it('reuses prefilled job id from jobs flow and skips job description upload', async () => {
    localStorage.setItem('master_resume_id', 'resume-master-1');
    localStorage.setItem(
      'flow_prefill_job_v1',
      JSON.stringify({
        jobId: 'job-prefilled-1',
        jobDescription:
          'Platform reliability role owning backend APIs, distributed systems, observability, and incident response excellence.',
        source: 'jobs',
        createdAt: '2026-04-23T00:00:00.000Z',
      })
    );
    mockedSearchParams.set('prefill_job', '1');

    render(<ProductFlowPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(/Platform reliability role owning backend APIs/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.generatePreview' }));

    await waitFor(() => {
      expect(mockedUploadJobDescriptions).not.toHaveBeenCalled();
      expect(mockedPreviewImproveResume).toHaveBeenCalledWith('resume-master-1', 'job-prefilled-1');
    });
  });

  it('returns to job board with preserved jobs query context', () => {
    mockedSearchParams.set('jobs_return_query', 'search=Platform+Engineer&status=all&source=applications');

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.backToJobsContext' }));

    expect(mockedPush).toHaveBeenCalledWith('/jobs?search=Platform+Engineer&status=all&source=applications');
  });

  it('normalizes missing jobs snapshot source to flow when returning to job board', () => {
    mockedSearchParams.set('jobs_return_query', 'search=Platform+Engineer&status=active');

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.backToJobsContext' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/jobs?')).toBe(true);
    const params = new URLSearchParams(href.replace('/jobs?', ''));
    expect(params.get('search')).toBe('Platform Engineer');
    expect(params.get('status')).toBe('active');
    expect(params.get('source')).toBe('flow');
  });

  it('adds fallback status when jobs snapshot omits status in back-to-jobs flow context', () => {
    mockedSearchParams.set('jobs_return_query', 'search=Platform+Engineer');

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.backToJobsContext' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/jobs?')).toBe(true);
    const params = new URLSearchParams(href.replace('/jobs?', ''));
    expect(params.get('search')).toBe('Platform Engineer');
    expect(params.get('status')).toBe('all');
    expect(params.get('source')).toBe('flow');
  });

  it('adds focused job id to back-to-jobs context when jobs snapshot has no focus', async () => {
    localStorage.setItem('master_resume_id', 'resume-master-1');
    localStorage.setItem(
      'flow_prefill_job_v1',
      JSON.stringify({
        jobId: 'job-prefilled-1',
        jobDescription:
          'Platform reliability role owning backend APIs, distributed systems, observability, and incident response excellence.',
        source: 'jobs',
        createdAt: '2026-04-23T00:00:00.000Z',
      })
    );
    mockedSearchParams.set('prefill_job', '1');
    mockedSearchParams.set('jobs_return_query', 'search=Platform+Engineer&status=all&source=applications');

    render(<ProductFlowPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(/Platform reliability role owning backend APIs/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.backToJobsContext' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    const params = new URLSearchParams(href.replace('/jobs?', ''));
    expect(params.get('search')).toBe('Platform Engineer');
    expect(params.get('status')).toBe('all');
    expect(params.get('source')).toBe('applications');
    expect(params.get('focus_job_id')).toBe('job-prefilled-1');
  });

  it('returns to focused job board context when jobs return query is missing', async () => {
    localStorage.setItem('master_resume_id', 'resume-master-1');
    localStorage.setItem(
      'flow_prefill_job_v1',
      JSON.stringify({
        jobId: 'job-prefilled-1',
        jobDescription:
          'Platform reliability role owning backend APIs, distributed systems, observability, and incident response excellence.',
        source: 'jobs',
        createdAt: '2026-04-23T00:00:00.000Z',
      })
    );
    mockedSearchParams.set('prefill_job', '1');

    render(<ProductFlowPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(/Platform reliability role owning backend APIs/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.backToJobsContext' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/jobs?')).toBe(true);
    const params = new URLSearchParams(href.replace('/jobs?', ''));
    expect(params.get('focus_job_id')).toBe('job-prefilled-1');
    expect(params.get('status')).toBe('all');
    expect(params.get('source')).toBe('flow');
  });

  it('returns to flow-context job board when jobs return query and focus are both missing', () => {
    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.backToJobsContext' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/jobs?')).toBe(true);
    const params = new URLSearchParams(href.replace('/jobs?', ''));
    expect(params.get('status')).toBe('all');
    expect(params.get('source')).toBe('flow');
    expect(params.get('focus_job_id')).toBeNull();
  });

  it('shows focused-job context badge when opened from focused jobs banner', () => {
    mockedSearchParams.set('focused_job', '1');

    render(<ProductFlowPage />);

    expect(screen.getByText('flow.messages.openedFromFocusedJob')).toBeInTheDocument();
  });

  it('confirms tailored resume and opens pdf/viewer actions', async () => {
    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'mock-upload' }));

    const textarea = screen.getByPlaceholderText('flow.sections.jobDescriptionPlaceholder');
    fireEvent.change(textarea, {
      target: {
        value:
          'Platform engineer role focused on reliability, distributed systems, and production readiness ownership.',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.generatePreview' }));

    await waitFor(() => {
      expect(mockedPreviewImproveResume).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.confirmAndCreate' }));

    await waitFor(() => {
      expect(mockedConfirmImproveResume).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.openPdf' }));
    expect(mockedWindowOpen).toHaveBeenCalledWith(
      'http://localhost:3001/api/resumes/tailored-1/pdf',
      '_blank',
      'noopener,noreferrer'
    );

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.openResumeViewer' }));
    expect(mockedPush).toHaveBeenCalledWith('/resumes/tailored-1');
  });

  it('shows validation error and skips API calls when job description is too short', async () => {
    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'mock-upload' }));

    const textarea = screen.getByPlaceholderText('flow.sections.jobDescriptionPlaceholder');
    fireEvent.change(textarea, {
      target: {
        value: 'too short jd',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.generatePreview' }));

    await waitFor(() => {
      expect(screen.getByText('flow.errors.jobDescriptionTooShort')).toBeInTheDocument();
    });

    expect(mockedUploadJobDescriptions).not.toHaveBeenCalled();
    expect(mockedPreviewImproveResume).not.toHaveBeenCalled();
  });

  it('shows confirm error when confirm API fails', async () => {
    mockedConfirmImproveResume.mockRejectedValueOnce(new Error('confirm failed'));

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'mock-upload' }));

    const textarea = screen.getByPlaceholderText('flow.sections.jobDescriptionPlaceholder');
    fireEvent.change(textarea, {
      target: {
        value:
          'Staff backend role requiring strong distributed systems design, observability, and incident management ownership.',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.generatePreview' }));

    await waitFor(() => {
      expect(mockedPreviewImproveResume).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.confirmAndCreate' }));

    await waitFor(() => {
      expect(screen.getByText('flow.errors.confirmFailed')).toBeInTheDocument();
    });
  });

  it('resets stale preview when job description changes after preview generation', async () => {
    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'mock-upload' }));

    const textarea = screen.getByPlaceholderText('flow.sections.jobDescriptionPlaceholder');
    fireEvent.change(textarea, {
      target: {
        value:
          'Senior backend role requiring deep expertise in APIs, resilience, and distributed systems operations.',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.generatePreview' }));

    await waitFor(() => {
      expect(mockedPreviewImproveResume).toHaveBeenCalled();
    });

    const confirmButton = screen.getByRole('button', { name: 'flow.actions.confirmAndCreate' });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.change(textarea, {
      target: {
        value:
          'Updated JD text requiring platform reliability engineering, SLOs, and production governance excellence.',
      },
    });

    await waitFor(() => {
      expect(screen.getByText('flow.messages.previewResetByInputChange')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'flow.actions.confirmAndCreate' })).toBeDisabled();
  });

  it('creates application from guided flow after confirm', async () => {
    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'mock-upload' }));

    const textarea = screen.getByPlaceholderText('flow.sections.jobDescriptionPlaceholder');
    fireEvent.change(textarea, {
      target: {
        value:
          'Senior platform role requiring API quality, incident ownership, and distributed systems reliability leadership.',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.generatePreview' }));

    await waitFor(() => {
      expect(mockedPreviewImproveResume).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.confirmAndCreate' }));

    await waitFor(() => {
      expect(mockedConfirmImproveResume).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.applyNow' }));

    await waitFor(() => {
      expect(mockedCreateApplication).toHaveBeenCalledWith({
        job_id: 'job-1',
        resume_id: 'tailored-1',
      });
    });

    expect(screen.getByText('flow.messages.applicationCreated')).toBeInTheDocument();
    expect(screen.getByText('flow.sections.applicationStatusReady')).toBeInTheDocument();
    expect(screen.getByText('flow.sessionHistory.count:1')).toBeInTheDocument();
    expect(screen.getByText('flow.sessionHistory.statusCreated')).toBeInTheDocument();
    expect(screen.getByText('flow.sessionHistory.jobId:job-1')).toBeInTheDocument();
    expect(screen.getByText('flow.sessionHistory.resumeId:tailored-1')).toBeInTheDocument();
    expect(screen.getByText('flow.sessionHistory.applicationId:app-1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.openApplications' }));
    let href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    let params = new URLSearchParams(href.replace('/applications?', ''));
    expect(params.get('job_id')).toBe('job-1');
    expect(params.get('application_id')).toBe('app-1');
    expect(params.get('flow_ctx')).toBe('1');
    let jobsReturn = new URLSearchParams(params.get('jobs_return_query') || '');
    expect(jobsReturn.get('focus_job_id')).toBe('job-1');
    expect(jobsReturn.get('status')).toBe('all');
    expect(jobsReturn.get('source')).toBe('flow');

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openApplicationsForItem' }));
    href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    params = new URLSearchParams(href.replace('/applications?', ''));
    expect(params.get('job_id')).toBe('job-1');
    expect(params.get('application_id')).toBe('app-1');
    expect(params.get('flow_ctx')).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openStatusHistoryForItem' }));
    href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    params = new URLSearchParams(href.replace('/applications?', ''));
    expect(params.get('job_id')).toBe('job-1');
    expect(params.get('application_id')).toBe('app-1');
    expect(params.get('sh_open')).toBe('1');
    expect(params.get('flow_ctx')).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openStatusChangesForItem' }));
    href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    params = new URLSearchParams(href.replace('/applications?', ''));
    expect(params.get('job_id')).toBe('job-1');
    expect(params.get('application_id')).toBe('app-1');
    expect(params.get('sc_open')).toBe('1');
    expect(params.get('flow_ctx')).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openFeedbackForItem' }));
    href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    params = new URLSearchParams(href.replace('/applications?', ''));
    expect(params.get('job_id')).toBe('job-1');
    expect(params.get('application_id')).toBe('app-1');
    expect(params.get('fb_open')).toBe('1');
    expect(params.get('flow_ctx')).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openResumeForItem' }));
    expect(mockedPush).toHaveBeenCalledWith('/resumes/tailored-1');
  });

  it('routes candidate open-applications actions to candidate history context', async () => {
    mockedAuthUser.id = 'candidate-42';
    mockedAuthUser.role = 'candidate';
    localStorage.setItem(
      'flow_apply_session_history_v1',
      JSON.stringify([
        {
          applicationId: 'app-777',
          jobId: 'job-777',
          resumeId: 'resume-777',
          outcome: 'created',
          createdAt: '2026-04-19T15:05:00.000Z',
        },
      ])
    );

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openApplicationsForItem' }));

    expect(mockedPush).toHaveBeenCalledWith(
      '/applications?candidate_id=candidate-42&application_id=app-777&candidate_focus=1&flow_ctx=1'
    );
  });

  it('restores applications snapshot from jobs return query when reopening applications', () => {
    mockedAuthUser.id = 'candidate-42';
    mockedAuthUser.role = 'candidate';
    localStorage.setItem(
      'flow_apply_session_history_v1',
      JSON.stringify([
        {
          applicationId: 'app-777',
          jobId: 'job-777',
          resumeId: 'resume-777',
          outcome: 'created',
          createdAt: '2026-04-19T15:05:00.000Z',
        },
      ])
    );

    mockedSearchParams.set(
      'jobs_return_query',
      'focus_job_id=job-777&source=applications&applications_return_query=candidate_id%3Dcandidate-42%26rc_changed_by%3Dqa-reviewer%26sc_preset%3D7d'
    );

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openApplicationsForItem' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/applications?')).toBe(true);
    const params = new URLSearchParams(href.replace('/applications?', ''));
    expect(params.get('candidate_id')).toBe('candidate-42');
    expect(params.get('rc_changed_by')).toBe('qa-reviewer');
    expect(params.get('sc_preset')).toBe('7d');
    expect(params.get('application_id')).toBe('app-777');
    expect(params.get('candidate_focus')).toBe('1');
    expect(params.get('flow_ctx')).toBe('1');

    const jobsReturn = params.get('jobs_return_query') || '';
    const jobsReturnParams = new URLSearchParams(jobsReturn);
    expect(jobsReturnParams.get('source')).toBe('applications');
    expect(jobsReturnParams.get('focus_job_id')).toBe('job-777');
  });

  it('propagates jobs return query to applications links from flow actions', async () => {
    mockedSearchParams.set('jobs_return_query', 'search=Platform+Engineer&status=active&page=2');

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'mock-upload' }));

    const textarea = screen.getByPlaceholderText('flow.sections.jobDescriptionPlaceholder');
    fireEvent.change(textarea, {
      target: {
        value:
          'Senior platform role requiring API quality, incident ownership, and distributed systems reliability leadership.',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.generatePreview' }));

    await waitFor(() => {
      expect(mockedPreviewImproveResume).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.confirmAndCreate' }));

    await waitFor(() => {
      expect(mockedConfirmImproveResume).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.applyNow' }));

    await waitFor(() => {
      expect(mockedCreateApplication).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.openApplications' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    const params = new URLSearchParams(href.replace('/applications?', ''));
    const jobsReturn = params.get('jobs_return_query') || '';
    const jobsReturnParams = new URLSearchParams(jobsReturn);
    expect(jobsReturnParams.get('search')).toBe('Platform Engineer');
    expect(jobsReturnParams.get('status')).toBe('active');
    expect(jobsReturnParams.get('page')).toBe('2');
  });

  it('restores panel open state from jobs return applications snapshot when flow panel hint is missing', () => {
    localStorage.setItem(
      'flow_apply_session_history_v1',
      JSON.stringify([
        {
          applicationId: 'app-777',
          jobId: 'job-777',
          resumeId: 'resume-777',
          outcome: 'created',
          createdAt: '2026-04-19T15:05:00.000Z',
        },
      ])
    );

    mockedSearchParams.set(
      'jobs_return_query',
      'focus_job_id=job-777&source=applications&applications_return_query=rc_focus%3Dfocus%26sc_open%3D1%26sc_preset%3D7d'
    );

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openApplicationsForItem' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/applications?')).toBe(true);
    const params = new URLSearchParams(href.replace('/applications?', ''));

    expect(params.get('rc_focus')).toBe('focus');
    expect(params.get('sc_preset')).toBe('7d');
    expect(params.get('job_id')).toBe('job-777');
    expect(params.get('application_id')).toBe('app-777');
    expect(params.get('sc_open')).toBe('1');
    expect(params.get('flow_ctx')).toBe('1');
  });

  it('applies fixed precedence from flow_return_query over top-level duplicates when reopening applications', () => {
    localStorage.setItem(
      'flow_apply_session_history_v1',
      JSON.stringify([
        {
          applicationId: 'app-777',
          jobId: 'job-777',
          resumeId: 'resume-777',
          outcome: 'created',
          createdAt: '2026-04-19T15:05:00.000Z',
        },
      ])
    );

    mockedSearchParams.set('rc_changed_by', 'top-level-reviewer');
    mockedSearchParams.set('sc_preset', '30d');
    mockedSearchParams.set('flow_panel', 'feedback');
    mockedSearchParams.set(
      'flow_return_query',
      'rc_changed_by=flow-reviewer&sc_preset=7d&flow_panel=status-changes'
    );

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openApplicationsForItem' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    const params = new URLSearchParams(href.replace('/applications?', ''));
    expect(params.get('rc_changed_by')).toBe('flow-reviewer');
    expect(params.get('sc_preset')).toBe('7d');
    expect(params.get('sc_open')).toBe('1');
    expect(params.get('fb_open')).toBeNull();
  });

  it('falls back to top-level applications filters when flow_return_query omits those keys', () => {
    localStorage.setItem(
      'flow_apply_session_history_v1',
      JSON.stringify([
        {
          applicationId: 'app-777',
          jobId: 'job-777',
          resumeId: 'resume-777',
          outcome: 'created',
          createdAt: '2026-04-19T15:05:00.000Z',
        },
      ])
    );

    mockedSearchParams.set('rc_changed_by', 'top-level-reviewer');
    mockedSearchParams.set('sc_preset', '30d');
    mockedSearchParams.set('flow_panel', 'feedback');
    mockedSearchParams.set('flow_return_query', 'rc_changed_by=flow-reviewer');

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openApplicationsForItem' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    const params = new URLSearchParams(href.replace('/applications?', ''));
    expect(params.get('rc_changed_by')).toBe('flow-reviewer');
    expect(params.get('sc_preset')).toBe('30d');
    expect(params.get('fb_open')).toBe('1');
    expect(params.get('sc_open')).toBeNull();
  });

  it('opens related job board from flow session history item', () => {
    localStorage.setItem(
      'flow_apply_session_history_v1',
      JSON.stringify([
        {
          applicationId: 'app-777',
          jobId: 'job-777',
          resumeId: 'resume-777',
          outcome: 'created',
          createdAt: '2026-04-19T15:05:00.000Z',
        },
      ])
    );

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openJobBoardForItem' }));

    expect(mockedPush).toHaveBeenCalledWith('/jobs?focus_job_id=job-777&status=all&source=flow');
  });

  it('normalizes invalid jobs snapshot source to flow when opening job board from flow session history item', () => {
    localStorage.setItem(
      'flow_apply_session_history_v1',
      JSON.stringify([
        {
          applicationId: 'app-777',
          jobId: 'job-777',
          resumeId: 'resume-777',
          outcome: 'created',
          createdAt: '2026-04-19T15:05:00.000Z',
        },
      ])
    );

    mockedSearchParams.set('jobs_return_query', 'search=Platform+Engineer&source=legacy');

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openJobBoardForItem' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    const params = new URLSearchParams(href.replace('/jobs?', ''));
    expect(params.get('search')).toBe('Platform Engineer');
    expect(params.get('focus_job_id')).toBe('job-777');
    expect(params.get('source')).toBe('flow');
  });

  it('preserves jobs return query snapshot when opening job board from flow session history item', () => {
    localStorage.setItem(
      'flow_apply_session_history_v1',
      JSON.stringify([
        {
          applicationId: 'app-777',
          jobId: 'job-777',
          resumeId: 'resume-777',
          outcome: 'created',
          createdAt: '2026-04-19T15:05:00.000Z',
        },
      ])
    );

    mockedSearchParams.set(
      'jobs_return_query',
      'search=Platform+Engineer&source=applications&applications_return_query=candidate_id%3Dcandidate-42%26rc_changed_by%3Dqa-reviewer'
    );

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openJobBoardForItem' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/jobs?')).toBe(true);

    const params = new URLSearchParams(href.replace('/jobs?', ''));
    expect(params.get('focus_job_id')).toBe('job-777');
    expect(params.get('status')).toBe('all');
    expect(params.get('search')).toBe('Platform Engineer');
    expect(params.get('source')).toBe('applications');

    const applicationsReturn = params.get('applications_return_query') || '';
    const returnParams = new URLSearchParams(applicationsReturn);
    expect(returnParams.get('candidate_id')).toBe('candidate-42');
    expect(returnParams.get('rc_changed_by')).toBe('qa-reviewer');
  });

  it('preserves jobs page and status from snapshot when opening job board from flow session history item', () => {
    localStorage.setItem(
      'flow_apply_session_history_v1',
      JSON.stringify([
        {
          applicationId: 'app-777',
          jobId: 'job-777',
          resumeId: 'resume-777',
          outcome: 'created',
          createdAt: '2026-04-19T15:05:00.000Z',
        },
      ])
    );

    mockedSearchParams.set(
      'jobs_return_query',
      'search=Data+Engineer&status=active&page=3&source=applications'
    );

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openJobBoardForItem' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/jobs?')).toBe(true);

    const params = new URLSearchParams(href.replace('/jobs?', ''));
    expect(params.get('focus_job_id')).toBe('job-777');
    expect(params.get('search')).toBe('Data Engineer');
    expect(params.get('status')).toBe('active');
    expect(params.get('page')).toBe('3');
    expect(params.get('source')).toBe('applications');
  });

  it('applies fixed filter precedence from jobs_return_query over top-level duplicates for flow history job-board action', () => {
    localStorage.setItem(
      'flow_apply_session_history_v1',
      JSON.stringify([
        {
          applicationId: 'app-777',
          jobId: 'job-777',
          resumeId: 'resume-777',
          outcome: 'created',
          createdAt: '2026-04-19T15:05:00.000Z',
        },
      ])
    );

    mockedSearchParams.set('search', 'Top Level Search');
    mockedSearchParams.set('status', 'closed');
    mockedSearchParams.set('page', '9');
    mockedSearchParams.set('location', 'Onsite');
    mockedSearchParams.set(
      'jobs_return_query',
      'search=Nested+Search&status=active&page=2&location=Remote&source=applications'
    );

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openJobBoardForItem' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    const params = new URLSearchParams(href.replace('/jobs?', ''));
    expect(params.get('search')).toBe('Nested Search');
    expect(params.get('status')).toBe('active');
    expect(params.get('page')).toBe('2');
    expect(params.get('location')).toBe('Remote');
    expect(params.get('source')).toBe('applications');
  });

  it('sanitizes nested jobs snapshot recursion for flow history job-board action', () => {
    localStorage.setItem(
      'flow_apply_session_history_v1',
      JSON.stringify([
        {
          applicationId: 'app-777',
          jobId: 'job-777',
          resumeId: 'resume-777',
          outcome: 'created',
          createdAt: '2026-04-19T15:05:00.000Z',
        },
      ])
    );

    mockedSearchParams.set(
      'jobs_return_query',
      'search=Nested+Search&status=active&jobs_return_query=page%3D2&applications_return_query=candidate_id%3Dcandidate-42%26rc_changed_by%3Dqa-reviewer&source=applications'
    );

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openJobBoardForItem' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    const params = new URLSearchParams(href.replace('/jobs?', ''));
    expect(params.get('search')).toBe('Nested Search');
    expect(params.get('status')).toBe('active');
    expect(params.get('focus_job_id')).toBe('job-777');
    expect(params.get('jobs_return_query')).toBeNull();

    const applicationsReturn = params.get('applications_return_query') || '';
    const returnParams = new URLSearchParams(applicationsReturn);
    expect(returnParams.get('candidate_id')).toBe('candidate-42');
    expect(returnParams.get('rc_changed_by')).toBe('qa-reviewer');
  });

  it('shows duplicate guidance when application already exists', async () => {
    const duplicateError = new Error('conflict');
    (duplicateError as Error & { statusCode?: number }).statusCode = 409;
    mockedCreateApplication.mockRejectedValueOnce(duplicateError);

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'mock-upload' }));

    const textarea = screen.getByPlaceholderText('flow.sections.jobDescriptionPlaceholder');
    fireEvent.change(textarea, {
      target: {
        value:
          'Backend reliability role requiring deep troubleshooting, observability ownership, and operational excellence.',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.generatePreview' }));

    await waitFor(() => {
      expect(mockedPreviewImproveResume).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.confirmAndCreate' }));

    await waitFor(() => {
      expect(mockedConfirmImproveResume).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.applyNow' }));

    await waitFor(() => {
      expect(screen.getByText('flow.messages.applicationDuplicate')).toBeInTheDocument();
    });

    expect(screen.getByText('flow.sessionHistory.count:1')).toBeInTheDocument();
    expect(screen.getByText('flow.sessionHistory.statusDuplicate')).toBeInTheDocument();
    expect(screen.getByText('flow.sessionHistory.applicationIdPending')).toBeInTheDocument();
    expect(screen.getByText(/^flow.sessionHistory.when:/)).toBeInTheDocument();
    expect(screen.queryByText('flow.errors.applicationFailed')).not.toBeInTheDocument();
  });

  it('resets job-specific state when starting next job in same session', async () => {
    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'mock-upload' }));

    const textarea = screen.getByPlaceholderText('flow.sections.jobDescriptionPlaceholder');
    fireEvent.change(textarea, {
      target: {
        value:
          'Reliability engineer role requiring API ownership, incident response, and observability excellence.',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.generatePreview' }));

    await waitFor(() => {
      expect(mockedPreviewImproveResume).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.confirmAndCreate' }));

    await waitFor(() => {
      expect(mockedConfirmImproveResume).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.applyNow' }));

    await waitFor(() => {
      expect(screen.getByText('flow.messages.applicationCreated')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.startNextJob' }));

    await waitFor(() => {
      expect(screen.getByText('flow.messages.readyForNextJob')).toBeInTheDocument();
    });

    expect(screen.getByText('flow.sections.applicationStatusPending')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'flow.actions.confirmAndCreate' })).toBeDisabled();
    expect(screen.getByText('flow.sections.jobIdLabelPending')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('flow.sections.jobDescriptionPlaceholder')).toHaveValue('');
    expect(screen.getByText('flow.sections.currentMasterResume:resume-master-1')).toBeInTheDocument();
    expect(screen.getByText('flow.sessionHistory.count:1')).toBeInTheDocument();
    expect(screen.getByText('flow.sessionHistory.statusCreated')).toBeInTheDocument();
  });

  it('restores apply session history after page remount', async () => {
    const firstRender = render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'mock-upload' }));

    const textarea = screen.getByPlaceholderText('flow.sections.jobDescriptionPlaceholder');
    fireEvent.change(textarea, {
      target: {
        value:
          'Platform role requiring service ownership, observability maturity, and robust API lifecycle practices.',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.generatePreview' }));

    await waitFor(() => {
      expect(mockedPreviewImproveResume).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.confirmAndCreate' }));

    await waitFor(() => {
      expect(mockedConfirmImproveResume).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.applyNow' }));

    await waitFor(() => {
      expect(screen.getByText('flow.sessionHistory.count:1')).toBeInTheDocument();
    });

    firstRender.unmount();

    render(<ProductFlowPage />);

    expect(screen.getByText('flow.sessionHistory.count:1')).toBeInTheDocument();
    expect(screen.getByText('flow.sessionHistory.statusCreated')).toBeInTheDocument();
  });

  it('highlights returned session-history item from applications context', async () => {
    localStorage.setItem(
      'flow_apply_session_history_v1',
      JSON.stringify([
        {
          applicationId: 'app-111',
          jobId: 'job-111',
          resumeId: 'resume-111',
          outcome: 'created',
          createdAt: '2026-04-19T15:00:00.000Z',
        },
        {
          applicationId: 'app-777',
          jobId: 'job-777',
          resumeId: 'resume-777',
          outcome: 'created',
          createdAt: '2026-04-19T15:05:00.000Z',
        },
      ])
    );
    mockedSearchParams.set('flow_return_job_id', 'job-777');
    mockedSearchParams.set('flow_return_application_id', 'app-777');

    render(<ProductFlowPage />);

    await waitFor(() => {
      expect(screen.getByText('flow.sessionHistory.returnFocusBadge')).toBeInTheDocument();
      const targetRow = document.querySelector('[data-flow-return-target="true"]');
      expect(targetRow).toBeTruthy();
      expect(targetRow?.textContent).toContain('flow.sessionHistory.applicationId:app-777');
    });

    expect(mockedScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('preserves return query snapshot when reopening applications from history item', async () => {
    localStorage.setItem(
      'flow_apply_session_history_v1',
      JSON.stringify([
        {
          applicationId: 'app-777',
          jobId: 'job-777',
          resumeId: 'resume-777',
          outcome: 'created',
          createdAt: '2026-04-19T15:05:00.000Z',
        },
      ])
    );
    mockedSearchParams.set('flow_return_query', 'rc_focus=focus&rc_changed_by=qa-reviewer&sc_preset=7d');

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openApplicationsForItem' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/applications?')).toBe(true);
    const params = new URLSearchParams(href.replace('/applications?', ''));
    expect(params.get('rc_focus')).toBe('focus');
    expect(params.get('rc_changed_by')).toBe('qa-reviewer');
    expect(params.get('sc_preset')).toBe('7d');
    expect(params.get('job_id')).toBe('job-777');
    expect(params.get('application_id')).toBe('app-777');
    expect(params.get('flow_ctx')).toBe('1');
    const jobsReturn = new URLSearchParams(params.get('jobs_return_query') || '');
    expect(jobsReturn.get('focus_job_id')).toBe('job-777');
    expect(jobsReturn.get('status')).toBe('all');
    expect(jobsReturn.get('source')).toBe('flow');
  });

  it('adds fallback jobs snapshot status/source when reopening applications from history item without job id', async () => {
    localStorage.setItem(
      'flow_apply_session_history_v1',
      JSON.stringify([
        {
          applicationId: 'app-777',
          jobId: '',
          resumeId: 'resume-777',
          outcome: 'created',
          createdAt: '2026-04-19T15:05:00.000Z',
        },
      ])
    );
    mockedSearchParams.set('flow_return_query', 'rc_focus=focus&rc_changed_by=qa-reviewer');

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openApplicationsForItem' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/applications?')).toBe(true);
    const params = new URLSearchParams(href.replace('/applications?', ''));
    expect(params.get('job_id')).toBeNull();
    expect(params.get('application_id')).toBe('app-777');
    expect(params.get('flow_ctx')).toBe('1');
    const jobsReturn = new URLSearchParams(params.get('jobs_return_query') || '');
    expect(jobsReturn.get('focus_job_id')).toBeNull();
    expect(jobsReturn.get('status')).toBe('all');
    expect(jobsReturn.get('source')).toBe('flow');
  });

  it('keeps panel actions deterministic when reopening applications from history item without job id', async () => {
    localStorage.setItem(
      'flow_apply_session_history_v1',
      JSON.stringify([
        {
          applicationId: 'app-777',
          jobId: '',
          resumeId: 'resume-777',
          outcome: 'created',
          createdAt: '2026-04-19T15:05:00.000Z',
        },
      ])
    );
    mockedSearchParams.set('flow_return_query', 'rc_focus=focus&rc_changed_by=qa-reviewer');

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openStatusHistoryForItem' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/applications?')).toBe(true);
    const params = new URLSearchParams(href.replace('/applications?', ''));
    expect(params.get('job_id')).toBeNull();
    expect(params.get('application_id')).toBe('app-777');
    expect(params.get('sh_open')).toBe('1');
    expect(params.get('flow_ctx')).toBe('1');
    const jobsReturn = new URLSearchParams(params.get('jobs_return_query') || '');
    expect(jobsReturn.get('status')).toBe('all');
    expect(jobsReturn.get('source')).toBe('flow');
    expect(jobsReturn.get('focus_job_id')).toBeNull();
  });

  it('reopens preferred feedback panel from flow return snapshot when opening applications', async () => {
    localStorage.setItem(
      'flow_apply_session_history_v1',
      JSON.stringify([
        {
          applicationId: 'app-777',
          jobId: 'job-777',
          resumeId: 'resume-777',
          outcome: 'created',
          createdAt: '2026-04-19T15:05:00.000Z',
        },
      ])
    );
    mockedSearchParams.set('flow_return_query', 'rc_focus=focus&flow_panel=feedback');

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openApplicationsForItem' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/applications?')).toBe(true);
    const params = new URLSearchParams(href.replace('/applications?', ''));
    expect(params.get('rc_focus')).toBe('focus');
    expect(params.get('job_id')).toBe('job-777');
    expect(params.get('application_id')).toBe('app-777');
    expect(params.get('fb_open')).toBe('1');
    expect(params.get('flow_ctx')).toBe('1');
    const jobsReturn = new URLSearchParams(params.get('jobs_return_query') || '');
    expect(jobsReturn.get('focus_job_id')).toBe('job-777');
    expect(jobsReturn.get('status')).toBe('all');
    expect(jobsReturn.get('source')).toBe('flow');
  });

  it('reopens preferred status-changes panel from flow return snapshot when opening applications', async () => {
    localStorage.setItem(
      'flow_apply_session_history_v1',
      JSON.stringify([
        {
          applicationId: 'app-777',
          jobId: 'job-777',
          resumeId: 'resume-777',
          outcome: 'created',
          createdAt: '2026-04-19T15:05:00.000Z',
        },
      ])
    );
    mockedSearchParams.set('flow_return_query', 'rc_focus=focus&flow_panel=status-changes');

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openApplicationsForItem' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/applications?')).toBe(true);
    const params = new URLSearchParams(href.replace('/applications?', ''));
    expect(params.get('rc_focus')).toBe('focus');
    expect(params.get('job_id')).toBe('job-777');
    expect(params.get('application_id')).toBe('app-777');
    expect(params.get('sc_open')).toBe('1');
    expect(params.get('flow_ctx')).toBe('1');
    const jobsReturn = new URLSearchParams(params.get('jobs_return_query') || '');
    expect(jobsReturn.get('focus_job_id')).toBe('job-777');
    expect(jobsReturn.get('status')).toBe('all');
    expect(jobsReturn.get('source')).toBe('flow');
  });

  it('prioritizes explicit session-history panel action over snapshot panel hint', async () => {
    localStorage.setItem(
      'flow_apply_session_history_v1',
      JSON.stringify([
        {
          applicationId: 'app-777',
          jobId: 'job-777',
          resumeId: 'resume-777',
          outcome: 'created',
          createdAt: '2026-04-19T15:05:00.000Z',
        },
      ])
    );
    mockedSearchParams.set('flow_return_query', 'rc_focus=focus&flow_panel=status-history');

    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openFeedbackForItem' }));

    const href = String(mockedPush.mock.calls.at(-1)?.[0] || '');
    expect(href.startsWith('/applications?')).toBe(true);
    const params = new URLSearchParams(href.replace('/applications?', ''));
    expect(params.get('rc_focus')).toBe('focus');
    expect(params.get('job_id')).toBe('job-777');
    expect(params.get('application_id')).toBe('app-777');
    expect(params.get('fb_open')).toBe('1');
    expect(params.get('flow_ctx')).toBe('1');
    const jobsReturn = new URLSearchParams(params.get('jobs_return_query') || '');
    expect(jobsReturn.get('focus_job_id')).toBe('job-777');
    expect(jobsReturn.get('status')).toBe('all');
    expect(jobsReturn.get('source')).toBe('flow');
  });

  it('filters and clears session history entries', async () => {
    render(<ProductFlowPage />);

    fireEvent.click(screen.getByRole('button', { name: 'mock-upload' }));

    const textarea = screen.getByPlaceholderText('flow.sections.jobDescriptionPlaceholder');
    fireEvent.change(textarea, {
      target: {
        value:
          'First role requiring platform ownership, observability standards, and service reliability engineering.',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.generatePreview' }));

    await waitFor(() => {
      expect(mockedPreviewImproveResume).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.confirmAndCreate' }));

    await waitFor(() => {
      expect(mockedConfirmImproveResume).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.applyNow' }));

    await waitFor(() => {
      expect(screen.getByText('flow.sessionHistory.count:1')).toBeInTheDocument();
    });

    const duplicateError = new Error('conflict');
    (duplicateError as Error & { statusCode?: number }).statusCode = 409;
    mockedCreateApplication.mockRejectedValueOnce(duplicateError);

    fireEvent.click(screen.getByRole('button', { name: 'flow.actions.applyNow' }));

    await waitFor(() => {
      expect(screen.getByText('flow.sessionHistory.count:2')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.exportAction' }));
    expect(mockedDownloadBlobAsFile).toHaveBeenCalledTimes(1);
    const exportCall = mockedDownloadBlobAsFile.mock.calls[0];
    expect(exportCall[0]).toBeInstanceOf(Blob);
    expect(exportCall[1]).toMatch(/^flow-apply-session-history-.*\.json$/);
    expect(screen.getByText('flow.messages.sessionHistoryExported')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.filterCreated' }));
    expect(screen.getByText('flow.sessionHistory.filteredFromTotal:2')).toBeInTheDocument();
    expect(screen.getByText('flow.sessionHistory.statusCreated')).toBeInTheDocument();
    expect(screen.queryByText('flow.sessionHistory.statusDuplicate')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.filterDuplicate' }));
    expect(screen.getByText('flow.sessionHistory.filteredFromTotal:2')).toBeInTheDocument();
    expect(screen.getByText('flow.sessionHistory.statusDuplicate')).toBeInTheDocument();
    expect(screen.queryByText('flow.sessionHistory.statusCreated')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.clearAction' }));

    await waitFor(() => {
      expect(screen.getByText('flow.messages.sessionHistoryCleared')).toBeInTheDocument();
    });
    expect(screen.getByText('flow.sessionHistory.count:0')).toBeInTheDocument();
    expect(screen.getByText('flow.sessionHistory.empty')).toBeInTheDocument();
  });
});
