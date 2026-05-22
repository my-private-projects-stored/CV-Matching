import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedAnalyzeResume = vi.fn();
const mockedRegenerateItems = vi.fn();

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/lib/api/enrichment', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/enrichment')>('@/lib/api/enrichment');
  return {
    ...actual,
    analyzeResume: (...args: unknown[]) => mockedAnalyzeResume(...args),
    regenerateItems: (...args: unknown[]) => mockedRegenerateItems(...args),
    applyEnhancements: vi.fn(),
    generateEnhancements: vi.fn(),
    applyRegeneratedItems: vi.fn(),
  };
});

import { useEnrichmentWizard } from '@/hooks/use-enrichment-wizard';
import { useRegenerateWizard } from '@/hooks/use-regenerate-wizard';

describe('privacy-blocked AI messaging in enrichment flows', () => {
  beforeEach(() => {
    mockedAnalyzeResume.mockReset();
    mockedRegenerateItems.mockReset();
  });

  it('maps analyze privacy-block error code to user-facing policy message', async () => {
    const blockedError = new Error('blocked') as Error & { errorCode?: string };
    blockedError.errorCode = 'provider_blocked_by_privacy_mode';
    mockedAnalyzeResume.mockRejectedValue(blockedError);

    const { result } = renderHook(() => useEnrichmentWizard('resume-1'));

    await act(async () => {
      await result.current.startAnalysis();
    });

    await waitFor(() => {
      expect(result.current.state.step).toBe('error');
      expect(result.current.state.error).toBe('tailor.errors.privacyModeBlocked');
    });
  });

  it('maps regenerate privacy-block error code to user-facing policy message', async () => {
    const blockedError = new Error('blocked') as Error & { errorCode?: string };
    blockedError.errorCode = 'provider_blocked_by_privacy_mode';
    mockedRegenerateItems.mockRejectedValue(blockedError);

    const { result } = renderHook(() =>
      useRegenerateWizard({
        resumeId: 'resume-1',
        outputLanguage: 'en',
      })
    );

    act(() => {
      result.current.startRegenerate();
      result.current.setSelectedItems([
        {
          item_id: 'exp_0',
          item_type: 'experience',
          title: 'Engineer',
          current_content: ['old'],
        },
      ]);
    });

    await act(async () => {
      await result.current.generate();
    });

    await waitFor(() => {
      expect(result.current.step).toBe('instructing');
      expect(result.current.error).toBe('tailor.errors.privacyModeBlocked');
    });
  });
});
