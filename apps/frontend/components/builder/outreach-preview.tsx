'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Linkedin, Mail } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

export interface OutreachPreviewProps {
  /** Outreach message content */
  content: string;
  /** Additional class names */
  className?: string;
}

export function OutreachPreview({ content, className }: OutreachPreviewProps) {
  const { t } = useTranslations();
  return (
    <div
      className={cn(
        'rounded-2xl border border-[color:var(--border)] bg-white',
        'shadow-[0_18px_32px_rgba(15,27,45,0.14)]',
        'overflow-hidden',
        className
      )}
    >
      {/* Preview Header */}
      <div className="p-4 border-b border-[color:var(--border)] bg-[var(--surface-muted)]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Linkedin className="w-4 h-4 text-[#0077B5]" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em]">
              {t('outreach.preview.channels.linkedin')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[color:var(--text-subtle)]" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em]">
              {t('outreach.preview.channels.email')}
            </span>
          </div>
        </div>
      </div>

      {/* Message Preview */}
      <div className="p-6 md:p-8">
        {content ? (
          <div className="space-y-4">
            {/* Message Bubble Style */}
            <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] p-4 shadow-[0_12px_22px_rgba(15,27,45,0.12)]">
              <p className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-[var(--foreground)]">
                {content}
              </p>
            </div>

            {/* Usage Tips */}
            <div className="pt-4 border-t border-[color:var(--border)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)] mb-2">
                {t('outreach.preview.howToUseTitle')}
              </p>
              <ul className="text-xs text-[color:var(--text-subtle)] space-y-1">
                <li>{t('outreach.preview.steps.step1')}</li>
                <li>{t('outreach.preview.steps.step2')}</li>
                <li>{t('outreach.preview.steps.step3')}</li>
                <li>{t('outreach.preview.steps.step4')}</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-[color:var(--text-subtle)]">
            <p className="text-sm">{t('outreach.preview.emptyTitle')}</p>
            <p className="text-xs mt-2">{t('outreach.preview.emptyDescription')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
