'use client';

import { useMemo, useState } from 'react';
import { type ResumeData } from '@/components/dashboard/resume-component';
import { extractKeywords, calculateMatchStats } from '@/lib/utils/keyword-matcher';
import { JDDisplay } from './jd-display';
import { HighlightedResumeView } from './highlighted-resume-view';
import { CheckCircle, Target, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import { ScoreBar } from '@/components/ui/ScoreBar';
import { scoreColor } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';

interface JDComparisonViewProps {
  jobDescription: string;
  resumeData: ResumeData;
}

/**
 * Split view comparing job description with resume.
 * Top: Score ring + keyword match bar + missing keywords
 * Bottom: JD (left) | Resume with highlights (right)
 */
export function JDComparisonView({ jobDescription, resumeData }: JDComparisonViewProps) {
  const { t } = useTranslations();
  const [showAllMissing, setShowAllMissing] = useState(false);

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

  // Derive missing keywords
  const missingKeywords = useMemo(() => {
    const resumeKeywords = extractKeywords(resumeText);
    return [...keywords].filter((kw) => !resumeKeywords.has(kw));
  }, [keywords, resumeText]);

  const displayedMissing = showAllMissing ? missingKeywords : missingKeywords.slice(0, 8);

  // Score ring values
  const ringScore = stats.matchPercentage;
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (ringScore / 100) * circumference;
  const color = scoreColor(ringScore / 100);

  return (
    <div className="h-full flex flex-col">
      {/* Score Panel */}
      <div className="px-4 py-3 bg-white border-b border-gray-200 space-y-3">
        {/* Top row: Score Ring + Stats */}
        <div className="flex items-center gap-4">
          {/* Mini Score Ring */}
          <div className="relative h-20 w-20 flex-shrink-0">
            <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
              <circle cx="40" cy="40" r="36" stroke="#e2e8f0" strokeWidth="6" fill="none" />
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke={color}
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-lg font-semibold tabular-nums">{ringScore}</span>
              <span className="text-[8px] uppercase tracking-[0.15em] text-gray-400">/100</span>
            </div>
          </div>

          {/* Score Bars + Stats */}
          <div className="flex-1 space-y-2">
            <ScoreBar
              label={t('builder.jdMatch.keywordMatchRate')}
              value={stats.matchPercentage / 100}
              color={color}
            />
            <div className="flex items-center gap-4 text-xs font-mono text-gray-600">
              <div className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-blue-600" />
                <span>{t('builder.jdMatch.stats.keywordsExtracted', { count: keywords.size })}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                <span>
                  {t('builder.jdMatch.matchedOf', {
                    matched: stats.matchCount,
                    total: stats.totalKeywords,
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Missing Keywords */}
        {missingKeywords.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-mono uppercase text-red-600 tracking-wider">
              <XCircle className="w-3.5 h-3.5" />
              <span>{t('builder.jdMatch.missingKeywordsTitle')}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {displayedMissing.map((kw) => (
                <span
                  key={kw}
                  className="inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700"
                >
                  {kw}
                </span>
              ))}
              {missingKeywords.length > 8 && (
                <button
                  type="button"
                  className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200 transition-colors"
                  onClick={() => setShowAllMissing(!showAllMissing)}
                >
                  {showAllMissing ? (
                    <>
                      {t('builder.jdMatch.showLess')} <ChevronUp className="w-3 h-3" />
                    </>
                  ) : (
                    <>
                      +{missingKeywords.length - 8} {t('builder.jdMatch.showAll')}{' '}
                      <ChevronDown className="w-3 h-3" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
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
