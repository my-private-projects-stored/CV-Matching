import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { JDComparisonView } from '@/components/builder/jd-comparison-view';
import type { ResumeData } from '@/components/dashboard/resume-component';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

describe('JDComparisonView', () => {
  it('renders missing keyword suggestions when resume does not match all JD keywords', () => {
    const resumeData: ResumeData = {
      summary: 'Built scalable React and Node applications',
      additional: {
        technicalSkills: ['React', 'Node'],
      },
    };

    render(
      <JDComparisonView jobDescription="React Node TypeScript Redis" resumeData={resumeData} />
    );

    expect(screen.getByText('builder.jdMatch.missingKeywordsTitle')).toBeInTheDocument();
    expect(screen.getByText('typescript')).toBeInTheDocument();
    expect(screen.getByText('redis')).toBeInTheDocument();
  });

  it('calls apply callback with missing keywords and selected mode', () => {
    const resumeData: ResumeData = {
      summary: 'Built scalable React and Node applications',
      additional: {
        technicalSkills: ['React', 'Node'],
      },
    };
    const onApplyMissingKeywords = vi.fn();

    render(
      <JDComparisonView
        jobDescription="React Node TypeScript Redis"
        resumeData={resumeData}
        onApplyMissingKeywords={onApplyMissingKeywords}
      />
    );

    fireEvent.click(screen.getByText('builder.jdMatch.applyMissingKeywordsWithSummary'));

    expect(onApplyMissingKeywords).toHaveBeenCalledTimes(1);
    expect(onApplyMissingKeywords).toHaveBeenCalledWith(
      ['redis', 'typescript'],
      'skills-and-summary'
    );
  });

  it('can apply missing keywords using skills-only mode', () => {
    const resumeData: ResumeData = {
      summary: 'Built scalable React and Node applications',
      additional: {
        technicalSkills: ['React', 'Node'],
      },
    };
    const onApplyMissingKeywords = vi.fn();

    render(
      <JDComparisonView
        jobDescription="React Node TypeScript Redis"
        resumeData={resumeData}
        onApplyMissingKeywords={onApplyMissingKeywords}
      />
    );

    fireEvent.click(screen.getByText('builder.jdMatch.applyMissingKeywordsSkillsOnly'));

    expect(onApplyMissingKeywords).toHaveBeenCalledTimes(1);
    expect(onApplyMissingKeywords).toHaveBeenCalledWith(['redis', 'typescript'], 'skills-only');
  });
});
