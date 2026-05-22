'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Save, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';

export interface CoverLetterEditorProps {
  /** Cover letter content */
  content: string;
  /** Callback when content changes */
  onChange: (content: string) => void;
  /** Callback when save is triggered */
  onSave: () => void;
  /** Whether save is in progress */
  isSaving: boolean;
  /** Additional class names */
  className?: string;
}

export function CoverLetterEditor({
  content,
  onChange,
  onSave,
  isSaving,
  className,
}: CoverLetterEditorProps) {
  const { t } = useTranslations();
  const wordCount = content
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  const charCount = content.length;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[color:var(--border)] bg-[var(--surface-muted)]">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em]">
            {t('coverLetter.title')}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[color:var(--text-subtle)]">
            {t('builder.contentStats.wordsChars', { wordCount, charCount })}
          </span>
          <Button size="sm" onClick={onSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 p-4 overflow-hidden">
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('coverLetter.editor.placeholder')}
          className={cn(
            'w-full h-full min-h-[400px] rounded-2xl border border-[color:var(--border)] bg-white p-4',
            'text-sm leading-relaxed text-[var(--foreground)]',
            'resize-none',
            'focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2',
            'placeholder:text-[color:var(--text-subtle)]'
          )}
        />
      </div>

      {/* Footer Tips */}
      <div className="p-4 border-t border-[color:var(--border)] bg-[var(--surface-muted)]">
        <p className="text-xs text-[color:var(--text-subtle)]">{t('coverLetter.editor.tip')}</p>
      </div>
    </div>
  );
}
