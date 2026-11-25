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
    <div
      className={cn(
        'rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-elev-1)] transition-all duration-200 hover:shadow-[var(--shadow-elev-2)]',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-3)]">
          {label}
        </p>
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--blue-50)] text-[var(--blue-700)]">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-[var(--text-1)]">
        {value}
      </p>
      {delta ? <p className="mt-2 text-xs text-[var(--text-2)]">{delta}</p> : null}
    </div>
  );
}
