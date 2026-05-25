import type { ApplicationStatus } from '@/types';
import { cn } from '@/lib/utils';

const statusMap: Record<ApplicationStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-50 text-[var(--blue-700)]' },
  screening: { label: 'Screening', className: 'bg-amber-50 text-[var(--warning)]' },
  interview: { label: 'Interview', className: 'bg-cyan-50 text-[var(--info)]' },
  offer: { label: 'Offer', className: 'bg-[var(--gold-dim)] text-[var(--gold)]' },
  hired: { label: 'Hired', className: 'bg-green-50 text-[var(--success)]' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-[var(--danger)]' },
};

export function StatusBadge({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  const config = statusMap[status];
  return (
    <span
      className={cn('rounded-full px-3 py-1 text-xs font-semibold', config.className, className)}
    >
      {config.label}
    </span>
  );
}
