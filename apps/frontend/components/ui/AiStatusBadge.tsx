import type { AiStatus } from '@/types';
import { cn } from '@/lib/utils';

const statusMap: Record<AiStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-slate-100 text-[var(--text-2)]' },
  parsing: { label: 'Parsing', className: 'bg-cyan-50 text-[var(--info)]' },
  scoring: { label: 'Scoring', className: 'bg-amber-50 text-[var(--warning)]' },
  completed: { label: 'Completed', className: 'bg-green-50 text-[var(--success)]' },
  failed: { label: 'Failed', className: 'bg-red-50 text-[var(--danger)]' },
};

export function AiStatusBadge({ status, className }: { status: AiStatus; className?: string }) {
  const config = statusMap[status];
  return (
    <span
      className={cn('rounded-full px-3 py-1 text-xs font-semibold', config.className, className)}
    >
      {config.label}
    </span>
  );
}
