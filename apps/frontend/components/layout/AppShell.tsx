import type { ReactNode } from 'react';
import type { UserRole } from '@/types';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell({
  role,
  breadcrumb,
  children,
}: {
  role: UserRole;
  breadcrumb?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Topbar breadcrumb={breadcrumb} />
      <div className="flex min-h-[calc(100vh-56px)]">
        <Sidebar role={role} activePath={breadcrumb} />
        <main className="flex-1 overflow-y-auto px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
