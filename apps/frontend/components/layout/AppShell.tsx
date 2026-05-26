'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Topbar breadcrumb={breadcrumb} />
      <div className="flex min-h-[calc(100vh-56px)]">
        <Sidebar role={role} activePath={pathname} />
        <main className="flex-1 overflow-y-auto px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
