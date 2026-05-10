'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

interface ResumeCardProps {
  type: 'new' | 'existing';
  title?: string;
  lastEdited?: string;
  onClick?: () => void;
}

export const ResumeCard = ({ type, title, lastEdited, onClick }: ResumeCardProps) => {
  const { t } = useTranslations();
  const baseClasses =
    'aspect-[3/4] w-full rounded-2xl border border-[color:var(--border)] bg-white p-6 shadow-[0_16px_28px_rgba(15,27,45,0.12)] transition-all duration-200 hover:-translate-y-1';

  if (type === 'new') {
    return (
      <button onClick={onClick} className={`${baseClasses} items-center justify-center group`}>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] p-4 text-[color:var(--text-subtle)] transition-colors group-hover:text-[var(--foreground)]">
          <Plus size={32} />
        </div>
        <span className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--foreground)]">
          {t('dashboard.createNew')}
        </span>
      </button>
    );
  }

  return (
    <div onClick={onClick} className={baseClasses}>
      <div className="relative mb-4 flex-1 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)]">
        {/* Placeholder for resume preview */}
        <div className="absolute inset-0 flex items-center justify-center text-xs text-[color:var(--text-subtle)]">
          {t('dashboard.preview')}
        </div>
      </div>
      <h3 className="text-lg font-semibold leading-tight truncate">{title}</h3>
      {lastEdited && (
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
          {t('dashboard.edited', { date: lastEdited })}
        </p>
      )}
    </div>
  );
};
