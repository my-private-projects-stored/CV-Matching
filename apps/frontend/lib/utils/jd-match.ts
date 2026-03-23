import { type ResumeData } from '@/components/dashboard/resume-component';

export interface ApplyMissingKeywordsResult {
  resumeData: ResumeData;
  addedSkillCount: number;
}

interface ApplyMissingKeywordsOptions {
  buildSummaryHint: (keywords: string[]) => string;
  maxSummaryKeywords?: number;
}

function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase();
}

function uniqueKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const keyword of keywords) {
    const trimmed = keyword.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = normalizeKeyword(trimmed);
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    results.push(trimmed);
  }

  return results;
}

export function applyMissingKeywordsToResumeData(
  source: ResumeData,
  missingKeywords: string[],
  options: ApplyMissingKeywordsOptions
): ApplyMissingKeywordsResult {
  const dedupedKeywords = uniqueKeywords(missingKeywords);
  const existingSkills = source.additional?.technicalSkills ?? [];
  const existingSkillSet = new Set(existingSkills.map((skill) => normalizeKeyword(skill)));

  const newSkills: string[] = [];
  for (const keyword of dedupedKeywords) {
    const normalized = normalizeKeyword(keyword);
    if (existingSkillSet.has(normalized)) {
      continue;
    }
    existingSkillSet.add(normalized);
    newSkills.push(keyword);
  }

  if (!newSkills.length) {
    return { resumeData: source, addedSkillCount: 0 };
  }

  const summary = source.summary?.trim() ?? '';
  const summaryLower = summary.toLowerCase();
  const maxSummaryKeywords = options.maxSummaryKeywords ?? 3;
  const summaryCandidates = newSkills
    .filter((keyword) => !summaryLower.includes(normalizeKeyword(keyword)))
    .slice(0, maxSummaryKeywords);

  const summaryHint = summaryCandidates.length ? options.buildSummaryHint(summaryCandidates) : '';
  const nextSummary = summaryHint
    ? summary
      ? `${summary}${summary.endsWith('.') ? '' : '.'} ${summaryHint}`
      : summaryHint
    : source.summary;

  return {
    resumeData: {
      ...source,
      summary: nextSummary,
      additional: {
        ...(source.additional ?? {}),
        technicalSkills: [...existingSkills, ...newSkills],
      },
    },
    addedSkillCount: newSkills.length,
  };
}
