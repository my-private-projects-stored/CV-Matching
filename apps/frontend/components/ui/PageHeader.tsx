import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4 pb-1', className)}>
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text-1)]">
          {title}
        </h1>
        {subtitle ? <p className="mt-1.5 text-sm text-[var(--text-2)]">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
