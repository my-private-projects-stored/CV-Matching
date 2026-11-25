'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, FileText, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';

export interface GeneratePromptProps {
  /** Type of content to generate */
  type: 'cover-letter' | 'outreach';
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** Callback to trigger generation */
  onGenerate: () => void;
  /** Whether this is a tailored resume (has job context) */
  isTailoredResume: boolean;
  /** Additional class names */
  className?: string;
}

export function GeneratePrompt({
  type,
  isGenerating,
  onGenerate,
  isTailoredResume,
  className,
}: GeneratePromptProps) {
  const { t } = useTranslations();
  const isOutreach = type === 'outreach';
  const Icon = isOutreach ? Mail : FileText;
  const title = isOutreach ? t('outreach.title') : t('coverLetter.title');

  // Show a softer note for non-tailored resumes — allow generation but explain it's generic
  const isNotTailored = !isTailoredResume;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center min-h-[380px] rounded-2xl border border-[var(--border)] bg-white p-10 text-center shadow-[var(--shadow-elev-1)]',
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl border border-[var(--blue-100)] bg-[var(--blue-50)] flex items-center justify-center mb-5">
        <Icon className="w-7 h-7 text-[var(--blue-700)]" />
      </div>
      <h3 className="font-display text-lg font-semibold text-[var(--text-1)] mb-2">
        {t('builder.generatePrompt.generateTitle', { title })}
      </h3>
      <p className="text-sm text-[var(--text-2)] max-w-md mb-5 leading-relaxed">
        {isOutreach
          ? t('builder.generatePrompt.outreachDescription')
          : t('builder.generatePrompt.coverLetterDescription')}
      </p>
      {isNotTailored && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 max-w-md mb-5 leading-relaxed">
          {t('builder.generatePrompt.notTailoredNote')}
        </p>
      )}
      <Button type="button" onClick={onGenerate} disabled={isGenerating} className="gap-2">
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('common.generating')}
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            {t('builder.generatePrompt.generateButton', { title })}
          </>
        )}
      </Button>
      <p className="text-xs text-[var(--text-3)] mt-4">
        {isOutreach
          ? t('builder.generatePrompt.outreachFooter')
          : t('builder.generatePrompt.coverLetterFooter')}
      </p>
    </div>
  );
}
