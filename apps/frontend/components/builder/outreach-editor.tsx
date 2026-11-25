'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Copy, Check, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n';
import { logError } from '@/lib/utils/logger';

export interface OutreachEditorProps {
  /** Outreach message content */
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

export function OutreachEditor({
  content,
  onChange,
  onSave,
  isSaving,
  className,
}: OutreachEditorProps) {
  const { t } = useTranslations();
  const [isCopied, setIsCopied] = React.useState(false);

  const wordCount = content
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  const charCount = content.length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      logError('outreach-editor', 'Failed to copy outreach content', err);
    }
  };

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
          <Mail className="w-4 h-4 text-[var(--blue-700)]" />
          <h2 className="text-sm font-semibold text-[var(--text-1)]">{t('outreach.title')}</h2>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs text-[var(--text-3)]">
            {t('builder.contentStats.wordsChars', { wordCount, charCount })}
          </span>
          <Button type="button" size="sm" variant="outline" onClick={onSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? t('common.saving') : t('common.save')}
          </Button>
          <Button type="button" size="sm" onClick={handleCopy} disabled={!content}>
            {isCopied ? (
              <>
                <Check className="w-4 h-4" />
                {t('outreach.copied')}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                {t('outreach.copy')}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 p-5 overflow-hidden">
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('outreach.editor.placeholder')}
          className={cn(
            'w-full h-full min-h-[250px] p-4 rounded-xl',
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
        <p className="text-xs text-[var(--text-3)]">{t('outreach.editor.tip')}</p>
      </div>
    </div>
  );
}
