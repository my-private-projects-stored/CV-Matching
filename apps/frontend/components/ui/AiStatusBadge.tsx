'use client';

import type { AiStatus } from '@/types';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';

const statusMap: Record<AiStatus, { className: string }> = {
  pending: { className: 'bg-slate-100 text-[var(--text-2)]' },
  parsing: { className: 'bg-cyan-50 text-[var(--info)]' },
  scoring: { className: 'bg-amber-50 text-[var(--warning)]' },
  completed: { className: 'bg-green-50 text-[var(--success)]' },
  failed: { className: 'bg-red-50 text-[var(--danger)]' },
};

export function AiStatusBadge({ status, className }: { status: AiStatus; className?: string }) {
  const { t } = useTranslations();
  const config = statusMap[status];
  return (
    <span
      className={cn('rounded-full px-3 py-1 text-xs font-semibold', config.className, className)}
    >
      {t(`aiStatus.${status}`)}
    </span>
  );
}
