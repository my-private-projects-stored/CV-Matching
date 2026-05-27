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
        'flex flex-col items-center justify-center min-h-[400px] p-12 text-center',
        className
      )}
    >
      <div className="w-16 h-16 border-2 border-blue-700 bg-blue-50 flex items-center justify-center mb-6">
        <Icon className="w-8 h-8 text-blue-700" />
      </div>
      <h3 className="font-mono text-sm font-bold uppercase tracking-wider mb-3">
        {t('builder.generatePrompt.generateTitle', { title })}
      </h3>
      <p className="font-mono text-xs text-gray-600 max-w-md mb-4 leading-relaxed">
        {isOutreach
          ? t('builder.generatePrompt.outreachDescription')
          : t('builder.generatePrompt.coverLetterDescription')}
      </p>
      {isNotTailored && (
        <p className="font-mono text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 max-w-md mb-4 leading-relaxed">
          {t('builder.generatePrompt.notTailoredNote')}
        </p>
      )}
      <Button onClick={onGenerate} disabled={isGenerating} className="gap-2">
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
      <p className="font-mono text-xs text-gray-400 mt-4">
        {isOutreach
          ? t('builder.generatePrompt.outreachFooter')
          : t('builder.generatePrompt.coverLetterFooter')}
      </p>
    </div>
  );
}
