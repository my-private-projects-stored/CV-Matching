import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function StatCard({
  icon,
  label,
  value,
  delta,
  className,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  delta?: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-[var(--border)] bg-white p-5 shadow', className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-3)]">
          {label}
        </p>
        {icon ? <span className="text-[var(--blue-700)]">{icon}</span> : null}
      </div>
      <p className="mt-4 font-display text-3xl text-[var(--text-1)]">{value}</p>
      {delta ? <p className="mt-2 text-xs text-[var(--text-2)]">{delta}</p> : null}
    </div>
  );
}
