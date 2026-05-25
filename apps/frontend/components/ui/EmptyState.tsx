import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white p-8 text-center">
      <p className="font-display text-2xl text-[var(--text-1)]">{title}</p>
      {description ? <p className="mt-2 text-sm text-[var(--text-2)]">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
