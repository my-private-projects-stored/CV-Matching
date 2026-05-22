'use client';

import { FileText } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

interface JDDisplayProps {
  content: string;
}

/**
 * Read-only display of the job description.
 * Shows the original JD text in a scrollable container.
 */
export function JDDisplay({ content }: JDDisplayProps) {
  const { t } = useTranslations();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-[color:var(--border)] bg-[var(--surface-muted)]">
        <FileText className="w-4 h-4 text-[color:var(--text-subtle)]" />
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--foreground)]">
          {t('builder.jdMatch.jobDescriptionTitle')}
        </h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
          {content}
        </div>
      </div>
    </div>
  );
}
