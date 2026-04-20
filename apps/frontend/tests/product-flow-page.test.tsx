import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const mockedPush = vi.fn();
const mockedSearchParams = new URLSearchParams();
const mockedUploadJobDescriptions = vi.fn();
const mockedPreviewImproveResume = vi.fn();
const mockedConfirmImproveResume = vi.fn();
const mockedGetResumePdfUrl = vi.fn();
const mockedCreateApplication = vi.fn();
const mockedWindowOpen = vi.fn();
const mockedScrollIntoView = vi.fn();

function resetMockedSearchParams() {
  const keys = Array.from(mockedSearchParams.keys());
  for (const key of keys) {
    mockedSearchParams.delete(key);
  }
}

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
    resetMockedSearchParams();
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
    expect(mockedPush).toHaveBeenCalledWith('/applications?job_id=job-1&application_id=app-1&flow_ctx=1');

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openApplicationsForItem' }));
    expect(mockedPush).toHaveBeenCalledWith('/applications?job_id=job-1&application_id=app-1&flow_ctx=1');

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openStatusHistoryForItem' }));
    expect(mockedPush).toHaveBeenCalledWith(
      '/applications?job_id=job-1&application_id=app-1&sh_open=1&flow_ctx=1'
    );

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openStatusChangesForItem' }));
    expect(mockedPush).toHaveBeenCalledWith(
      '/applications?job_id=job-1&application_id=app-1&sc_open=1&flow_ctx=1'
    );

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openFeedbackForItem' }));
    expect(mockedPush).toHaveBeenCalledWith(
      '/applications?job_id=job-1&application_id=app-1&fb_open=1&flow_ctx=1'
    );

    fireEvent.click(screen.getByRole('button', { name: 'flow.sessionHistory.openResumeForItem' }));
    expect(mockedPush).toHaveBeenCalledWith('/resumes/tailored-1');
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

    expect(mockedPush).toHaveBeenCalledWith(
      '/applications?rc_focus=focus&rc_changed_by=qa-reviewer&sc_preset=7d&job_id=job-777&application_id=app-777&flow_ctx=1'
    );
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

    expect(mockedPush).toHaveBeenCalledWith(
      '/applications?rc_focus=focus&job_id=job-777&application_id=app-777&fb_open=1&flow_ctx=1'
    );
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

    expect(mockedPush).toHaveBeenCalledWith(
      '/applications?rc_focus=focus&job_id=job-777&application_id=app-777&sc_open=1&flow_ctx=1'
    );
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

    expect(mockedPush).toHaveBeenCalledWith(
      '/applications?rc_focus=focus&job_id=job-777&application_id=app-777&fb_open=1&flow_ctx=1'
    );
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
