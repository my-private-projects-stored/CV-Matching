'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, FileText, Mail, ArrowRight } from 'lucide-react';
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
  /** Current AI output language label */
  outputLanguageLabel?: string;
  /** Additional class names */
  className?: string;
}

export function GeneratePrompt({
  type,
  isGenerating,
  onGenerate,
  isTailoredResume,
  outputLanguageLabel,
  className,
}: GeneratePromptProps) {
  const { t } = useTranslations();
  const isOutreach = type === 'outreach';
  const Icon = isOutreach ? Mail : FileText;
  const title = isOutreach ? t('outreach.title') : t('coverLetter.title');

  // Show a different message if resume is not tailored
  if (!isTailoredResume) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center min-h-[400px] p-12 text-center',
          className
        )}
      >
        <div className="w-16 h-16 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] flex items-center justify-center mb-6">
          <Icon className="w-8 h-8 text-[color:var(--text-subtle)]" />
        </div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)] mb-3">
          {t('builder.generatePrompt.notAvailableTitle', { title })}
        </h3>
        <p className="text-xs text-[color:var(--text-subtle)] max-w-md mb-6 leading-relaxed">
          {t('builder.generatePrompt.notAvailableDescription', { title })}
        </p>
        <div className="flex items-center gap-2 text-[var(--primary)] text-xs font-semibold uppercase tracking-[0.2em]">
          <span>{t('builder.generatePrompt.goToDashboard')}</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center min-h-[400px] p-12 text-center',
        className
      )}
    >
      <div className="w-16 h-16 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] flex items-center justify-center mb-6">
        <Icon className="w-8 h-8 text-[var(--primary)]" />
      </div>
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] mb-3">
        {t('builder.generatePrompt.generateTitle', { title })}
      </h3>
      <p className="text-xs text-[color:var(--text-subtle)] max-w-md mb-6 leading-relaxed">
        {isOutreach
          ? t('builder.generatePrompt.outreachDescription')
          : t('builder.generatePrompt.coverLetterDescription')}
      </p>
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
      <p className="text-xs text-[color:var(--text-subtle)] mt-4">
        {isOutreach
          ? t('builder.generatePrompt.outreachFooter')
          : t('builder.generatePrompt.coverLetterFooter')}
      </p>
      {outputLanguageLabel ? (
        <p className="text-[11px] text-[color:var(--text-subtle)] mt-3 px-2 py-1 rounded-full border border-[color:var(--border)] bg-[var(--surface-muted)]">
          {t('builder.generatePrompt.aiLanguageLabel')}: {outputLanguageLabel}
        </p>
      ) : null}
    </div>
  );
}
