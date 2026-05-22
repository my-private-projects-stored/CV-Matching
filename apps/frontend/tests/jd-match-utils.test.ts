import { describe, expect, it } from 'vitest';
import { applyMissingKeywordsToResumeData } from '@/lib/utils/jd-match';
import type { ResumeData } from '@/components/dashboard/resume-component';

describe('applyMissingKeywordsToResumeData', () => {
  it('adds only new skills and appends summary hint', () => {
    const source: ResumeData = {
      summary: 'Backend engineer with experience in distributed systems',
      additional: {
        technicalSkills: ['Node', 'MongoDB'],
      },
    };

    const result = applyMissingKeywordsToResumeData(source, ['Redis', 'TypeScript', 'node'], {
      buildSummaryHint: (keywords) => `Keywords aligned with this role: ${keywords.join(', ')}.`,
    });

    expect(result.addedSkillCount).toBe(2);
    expect(result.resumeData.additional?.technicalSkills).toEqual([
      'Node',
      'MongoDB',
      'Redis',
      'TypeScript',
    ]);
    expect(result.resumeData.summary).toContain(
      'Keywords aligned with this role: Redis, TypeScript.'
    );
  });

  it('returns unchanged data when all keywords already exist', () => {
    const source: ResumeData = {
      summary: 'Experienced with Node and Redis',
      additional: {
        technicalSkills: ['Node', 'Redis'],
      },
    };

    const result = applyMissingKeywordsToResumeData(source, ['redis', 'node'], {
      buildSummaryHint: () => 'unused',
    });

    expect(result.addedSkillCount).toBe(0);
    expect(result.resumeData).toBe(source);
  });

  it('supports skills-only mode without adding summary hint', () => {
    const source: ResumeData = {
      summary: 'Backend engineer with experience in distributed systems',
      additional: {
        technicalSkills: ['Node', 'MongoDB'],
      },
    };

    const result = applyMissingKeywordsToResumeData(source, ['Redis', 'TypeScript'], {
      includeSummaryHint: false,
      buildSummaryHint: (keywords) => `Keywords aligned with this role: ${keywords.join(', ')}.`,
    });

    expect(result.addedSkillCount).toBe(2);
    expect(result.resumeData.additional?.technicalSkills).toEqual([
      'Node',
      'MongoDB',
      'Redis',
      'TypeScript',
    ]);
    expect(result.resumeData.summary).toBe(source.summary);
  });
});
