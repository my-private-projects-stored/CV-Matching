'use client';

import { useMemo, useState } from 'react';
import { type ResumeData } from '@/components/dashboard/resume-component';
import { extractKeywords, calculateMatchStats } from '@/lib/utils/keyword-matcher';
import { JDDisplay } from './jd-display';
import { HighlightedResumeView } from './highlighted-resume-view';
import { CheckCircle, Target } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

type ApplyMissingKeywordsMode = 'skills-only' | 'skills-and-summary';

interface JDComparisonViewProps {
  jobDescription: string;
  resumeData: ResumeData;
  onApplyMissingKeywords?: (keywords: string[], mode: ApplyMissingKeywordsMode) => void;
}

/**
 * Split view comparing job description with resume.
 * Left: JD (read-only)
 * Right: Resume with matching keywords highlighted
 */
export function JDComparisonView({
  jobDescription,
  resumeData,
  onApplyMissingKeywords,
}: JDComparisonViewProps) {
  const { t } = useTranslations();
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);

  // Extract keywords from JD
  const keywords = useMemo(() => extractKeywords(jobDescription), [jobDescription]);

  // Build full resume text for stats calculation
  const resumeText = useMemo(() => {
    const parts: string[] = [];

    if (resumeData.summary) parts.push(resumeData.summary);

    resumeData.workExperience?.forEach((exp) => {
      if (exp.title) parts.push(exp.title);
      if (exp.company) parts.push(exp.company);
      exp.description?.forEach((d) => parts.push(d));
    });

    resumeData.education?.forEach((edu) => {
      if (edu.degree) parts.push(edu.degree);
      if (edu.institution) parts.push(edu.institution);
    });

    resumeData.personalProjects?.forEach((proj) => {
      if (proj.name) parts.push(proj.name);
      if (proj.role) parts.push(proj.role);
      proj.description?.forEach((d) => parts.push(d));
    });

    if (resumeData.additional) {
      resumeData.additional.technicalSkills?.forEach((s) => parts.push(s));
      resumeData.additional.languages?.forEach((l) => parts.push(l));
      resumeData.additional.certificationsTraining?.forEach((c) => parts.push(c));
    }

    return parts.join(' ');
  }, [resumeData]);

  // Calculate match statistics
  const stats = useMemo(() => calculateMatchStats(resumeText, keywords), [resumeText, keywords]);

  const missingKeywords = useMemo(() => {
    const missing: string[] = [];
    for (const keyword of keywords) {
      if (!stats.matchedKeywords.has(keyword)) {
        missing.push(keyword);
      }
    }
    return missing.sort((a, b) => a.localeCompare(b));
  }, [keywords, stats.matchedKeywords]);

  async function copyText(text: string) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedKeyword(text);
      window.setTimeout(() => setCopiedKeyword(null), 1500);
    } catch {
      setCopiedKeyword(null);
    }
  }

  async function copyAllMissingKeywords() {
    if (!missingKeywords.length) {
      return;
    }
    await copyText(missingKeywords.join(', '));
  }

  function applyMissingKeywords(mode: ApplyMissingKeywordsMode) {
    if (!missingKeywords.length || !onApplyMissingKeywords) {
      return;
    }
    onApplyMissingKeywords(missingKeywords, mode);
  }

  return (
    <div className="h-full flex flex-col">
      {/* Stats Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-mono">
              {t('builder.jdMatch.stats.keywordsExtracted', { count: keywords.size })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-mono">
              {t('builder.jdMatch.stats.matchesFound', { count: stats.matchCount })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-gray-600">
            {t('builder.jdMatch.stats.matchRateLabel')}
          </span>
          <span
            className={`text-lg font-bold ${
              stats.matchPercentage >= 50
                ? 'text-green-600'
                : stats.matchPercentage >= 30
                  ? 'text-yellow-600'
                  : 'text-red-600'
            }`}
          >
            {stats.matchPercentage}%
          </span>
        </div>
      </div>

      <div className="px-4 py-3 bg-[#F8F8F5] border-b border-gray-200 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-xs uppercase text-gray-700">
            {t('builder.jdMatch.missingKeywordsTitle', { count: missingKeywords.length })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-8 px-2 text-[11px]"
              onClick={copyAllMissingKeywords}
            >
              {t('builder.jdMatch.copyAllMissingKeywords')}
            </Button>
            <Button
              variant="outline"
              className="h-8 px-2 text-[11px]"
              onClick={() => applyMissingKeywords('skills-only')}
              disabled={!missingKeywords.length || !onApplyMissingKeywords}
            >
              {t('builder.jdMatch.applyMissingKeywordsSkillsOnly')}
            </Button>
            <Button
              className="h-8 px-2 text-[11px]"
              onClick={() => applyMissingKeywords('skills-and-summary')}
              disabled={!missingKeywords.length || !onApplyMissingKeywords}
            >
              {t('builder.jdMatch.applyMissingKeywordsWithSummary')}
            </Button>
          </div>
        </div>

        {missingKeywords.length ? (
          <div className="flex flex-wrap gap-2">
            {missingKeywords.slice(0, 24).map((keyword) => (
              <button
                key={keyword}
                type="button"
                className="inline-flex items-center gap-1 border border-black bg-white px-2 py-1 text-[11px] font-mono uppercase"
                onClick={() => copyText(keyword)}
              >
                <span>{keyword}</span>
                <span className="text-blue-700">{t('builder.jdMatch.copyKeyword')}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="font-mono text-xs uppercase text-green-700">
            {t('builder.jdMatch.missingKeywordsEmpty')}
          </p>
        )}

        {copiedKeyword ? (
          <p className="font-mono text-[11px] uppercase text-blue-700">
            {t('builder.jdMatch.copiedKeywordMessage', { keyword: copiedKeyword })}
          </p>
        ) : null}
      </div>

      {/* Split View */}
      <div className="flex-1 grid grid-cols-2 min-h-0">
        {/* Left: JD */}
        <div className="border-r border-gray-200 overflow-hidden">
          <JDDisplay content={jobDescription} />
        </div>

        {/* Right: Resume with highlights */}
        <div className="overflow-hidden">
          <HighlightedResumeView resumeData={resumeData} keywords={keywords} />
        </div>
      </div>
    </div>
  );
}
