'use client';
import type { GenerationMode } from '@/lib/types/generation';
import { Bot, FileText } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/translations';

interface GenerationModeBadgeProps {
  mode: GenerationMode | null | undefined;
  className?: string;
}

/**
 * A small badge that shows whether content was AI-generated or fell back to a template.
 * Renders nothing if mode is null/undefined.
 */
export function GenerationModeBadge({ mode, className = '' }: GenerationModeBadgeProps) {
  const { t } = useTranslations();
  if (!mode) return null;

  const isLlm = mode === 'llm';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
        isLlm
          ? 'bg-blue-50 text-blue-700 border border-blue-200'
          : 'bg-amber-50 text-amber-700 border border-amber-200'
      } ${className}`}
      title={isLlm ? t('generationMode.aiTitle') : t('generationMode.fallbackTitle')}
    >
      {isLlm ? (
        <>
          <Bot className="h-2.5 w-2.5" aria-hidden="true" />
          {t('generationMode.aiGenerated')}
        </>
      ) : (
        <>
          <FileText className="h-2.5 w-2.5" aria-hidden="true" />
          {t('generationMode.templateFallback')}
        </>
      )}
    </span>
  );
}
