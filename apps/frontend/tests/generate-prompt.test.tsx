import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GeneratePrompt } from '@/components/builder/generate-prompt';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'outreach.title') return 'Outreach';
      if (key === 'coverLetter.title') return 'Cover Letter';
      if (key === 'builder.generatePrompt.generateTitle') {
        return `Generate ${params?.title ?? ''}`.trim();
      }
      if (key === 'builder.generatePrompt.generateButton') {
        return `Generate ${params?.title ?? ''}`.trim();
      }
      if (key === 'builder.generatePrompt.aiLanguageLabel') {
        return 'AI Content Language';
      }
      return key;
    },
  }),
}));

describe('GeneratePrompt', () => {
  it('shows output language indicator when provided', () => {
    render(
      <GeneratePrompt
        type="cover-letter"
        isGenerating={false}
        onGenerate={vi.fn()}
        isTailoredResume
        outputLanguageLabel="English (EN)"
      />
    );

    expect(screen.getByText('AI Content Language: English (EN)')).toBeInTheDocument();
  });
});
