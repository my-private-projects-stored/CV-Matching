import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const mockedPush = vi.fn();
const mockedBack = vi.fn();
const mockedUploadJobDescriptions = vi.fn();
const mockedPreviewImproveResume = vi.fn();
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockedPush, back: mockedBack }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string, params?: Record<string, number>) => {
      if (key === 'tailor.charactersCount') {
        return `count:${params?.count ?? 0}`;
      }
      return key;
    },
  }),
}));

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'candidate-1', role: 'candidate' } }),
}));

vi.mock('@/components/common/resume_previewer_context', () => ({
  useResumePreview: () => ({ setImprovedData: vi.fn() }),
}));

vi.mock('@/lib/context/status-cache', () => ({
  useStatusCache: () => ({
    status: { llm_configured: true },
    isLoading: false,
    incrementJobs: vi.fn(),
    incrementImprovements: vi.fn(),
    incrementResumes: vi.fn(),
  }),
}));

vi.mock('@/lib/api/config', () => ({
  fetchPromptConfig: vi.fn().mockResolvedValue({
    default_prompt_id: 'keywords',
    prompt_options: [
      { id: 'keywords', label: 'Keywords', description: 'Keywords mode' },
    ],
  }),
}));

vi.mock('@/lib/api/resume', () => ({
  uploadJobDescriptions: (...args: unknown[]) => mockedUploadJobDescriptions(...args),
  previewImproveResume: (...args: unknown[]) => mockedPreviewImproveResume(...args),
  confirmImproveResume: vi.fn(),
}));

vi.mock('@/components/tailor/diff-preview-modal', () => ({
  DiffPreviewModal: () => null,
}));

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: () => null,
}));

import TailorPage from '@/app/(default)/tailor/page';

describe('TailorPage privacy-mode blocking', () => {
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockedPush.mockReset();
    mockedBack.mockReset();
    mockedUploadJobDescriptions.mockReset();
    mockedPreviewImproveResume.mockReset();
    localStorage.setItem('master_resume_id', 'resume-master-1');
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('shows privacy block message when backend returns provider_blocked_by_privacy_mode', async () => {
    mockedUploadJobDescriptions.mockResolvedValue('job-1');

    const blockedError = new Error('blocked by privacy mode') as Error & { errorCode?: string };
    blockedError.errorCode = 'provider_blocked_by_privacy_mode';
    mockedPreviewImproveResume.mockRejectedValue(blockedError);

    render(<TailorPage />);

    const textarea = await screen.findByPlaceholderText('tailor.jobDescriptionPlaceholder');
    fireEvent.change(textarea, {
      target: {
        value:
          'Senior backend engineer role focused on API quality, observability, and production incident response ownership.',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'tailor.generateTailored' }));

    await waitFor(() => {
      expect(screen.getByText('tailor.errors.privacyModeBlocked')).toBeInTheDocument();
    });
  });
});
