import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ImgHTMLAttributes, ReactNode } from 'react';

const mockedRefreshStatus = vi.fn();

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/image', () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => <span data-alt={props.alt || ''} />,
}));

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'recruiter-1', role: 'recruiter' },
    isLoading: false,
  }),
}));

vi.mock('@/lib/context/language-context', () => ({
  useLanguage: () => ({
    contentLanguage: 'en',
    uiLanguage: 'en',
    setContentLanguage: vi.fn(),
    setUiLanguage: vi.fn(),
    languageNames: { en: 'English', vi: 'Vietnamese' },
    supportedLanguages: ['en', 'vi'],
    isLoading: false,
  }),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/lib/context/status-cache', () => ({
  useStatusCache: () => ({
    status: {
      status: 'ready',
      llm_configured: true,
      llm_healthy: true,
      llm_provider: 'openrouter',
      privacy_mode: 'cloud_only',
      has_master_resume: true,
      database_stats: {
        total_resumes: 3,
        total_jobs: 4,
        total_improvements: 7,
        has_master_resume: true,
      },
    },
    isLoading: false,
    lastFetched: null,
    refreshStatus: mockedRefreshStatus,
  }),
}));

vi.mock('@/lib/api/config', () => ({
  fetchCompanyProfileConfig: vi.fn().mockResolvedValue(null),
  fetchLlmConfig: vi.fn().mockResolvedValue({
    provider: 'openai',
    model: 'gpt-5-nano-2025-08-07',
    api_key: '',
    api_base: null,
  }),
  fetchPrivacyConfig: vi.fn().mockResolvedValue({ privacy_mode: 'cloud_only' }),
  updateLlmConfig: vi.fn(),
  updatePrivacyConfig: vi.fn(),
  testLlmConnection: vi.fn(),
  fetchFeatureConfig: vi.fn().mockResolvedValue({
    enable_cover_letter: false,
    enable_outreach_message: false,
  }),
  updateCompanyProfileConfig: vi.fn(),
  updateFeatureConfig: vi.fn(),
  fetchPromptConfig: vi
    .fn()
    .mockResolvedValue({ default_prompt_id: 'keywords', prompt_options: [] }),
  updatePromptConfig: vi.fn(),
  clearAllApiKeys: vi.fn(),
  resetDatabase: vi.fn(),
  PROVIDER_INFO: {
    openai: { name: 'OpenAI', defaultModel: 'gpt-5-nano-2025-08-07', requiresKey: true },
    anthropic: { name: 'Anthropic', defaultModel: 'claude-haiku-4-5-20251001', requiresKey: true },
    openrouter: { name: 'OpenRouter', defaultModel: 'deepseek/deepseek-chat', requiresKey: true },
    gemini: { name: 'Google Gemini', defaultModel: 'gemini-3-flash-preview', requiresKey: true },
    deepseek: { name: 'DeepSeek', defaultModel: 'deepseek-chat', requiresKey: true },
    ollama: { name: 'Ollama (Local)', defaultModel: 'gemma3:4b', requiresKey: false },
  },
}));

import SettingsPage from '@/app/(default)/settings/page';

describe('SettingsPage system status cards', () => {
  beforeEach(() => {
    mockedRefreshStatus.mockReset();
  });

  it('renders provider and privacy mode status values', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('LLM Provider')).toBeInTheDocument();
      expect(screen.getAllByText('Privacy Mode').length).toBeGreaterThan(0);
      expect(screen.getByText('openrouter')).toBeInTheDocument();
      expect(screen.getByText('cloud_only')).toBeInTheDocument();
    });
  });
});
