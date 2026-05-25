import type { ReactNode } from 'react';

export function Topbar({ breadcrumb, right }: { breadcrumb?: string; right?: ReactNode }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--border)] bg-white px-6">
      <div className="flex items-center gap-2 text-sm text-[var(--text-2)]">
        <span className="font-semibold text-[var(--text-1)]">CV Matching</span>
        {breadcrumb ? <span className="text-[var(--text-3)]">/ {breadcrumb}</span> : null}
      </div>
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Search"
          className="h-9 w-48 rounded-lg border border-[var(--border)] px-3 text-xs"
        />
        {right}
        <div className="h-8 w-8 rounded-full bg-[var(--blue-100)]" />
      </div>
    </header>
  );
}
