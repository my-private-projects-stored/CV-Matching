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
    <div
      className={cn(
        'flex flex-col h-full rounded-2xl border border-[var(--border)] bg-white shadow-[var(--shadow-elev-1)] overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-slate-50/70">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--blue-700)]" />
          <h2 className="text-sm font-semibold text-[var(--text-1)]">{t('coverLetter.title')}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-[var(--text-3)]">
            {t('builder.contentStats.wordsChars', { wordCount, charCount })}
          </span>
          <Button type="button" size="sm" onClick={onSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 p-5 overflow-hidden">
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('coverLetter.editor.placeholder')}
          className={cn(
            'w-full h-full min-h-[400px] p-4 rounded-xl',
            'text-sm leading-relaxed text-[var(--text-1)]',
            'border border-[var(--border)] bg-white',
            'resize-none',
            'focus:outline-none focus:border-[var(--blue-600)] focus:ring-4 focus:ring-blue-600/10',
            'placeholder:text-[var(--text-3)]'
          )}
        />
      </div>

      {/* Footer Tips */}
      <div className="px-5 py-3 border-t border-[var(--border)] bg-slate-50/50">
        <p className="text-xs text-[var(--text-3)]">{t('coverLetter.editor.tip')}</p>
      </div>
    </div>
  );
}
