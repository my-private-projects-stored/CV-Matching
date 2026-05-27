'use client';

import type { ApplicationStatus } from '@/types';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';

const statusMap: Record<ApplicationStatus, { className: string }> = {
  new: { className: 'bg-[var(--blue-100)] text-[var(--blue-700)]' },
  screening: { className: 'bg-amber-50 text-[var(--warning)]' },
  interview: { className: 'bg-cyan-50 text-[var(--info)]' },
  offer: { className: 'bg-[var(--gold-dim)] text-[var(--gold)]' },
  hired: { className: 'bg-green-50 text-[var(--success)]' },
  rejected: { className: 'bg-red-50 text-[var(--danger)]' },
};

export function StatusBadge({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  const { t } = useTranslations();
  const config = statusMap[status];
  return (
    <span
      className={cn('rounded-full px-3 py-1 text-xs font-semibold', config.className, className)}
    >
      {t(`status.${status}`)}
    </span>
  );
}
