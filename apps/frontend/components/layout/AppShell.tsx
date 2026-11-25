'use client';

import { useState, type ReactNode } from 'react';
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Topbar breadcrumb={breadcrumb} onMenuToggle={() => setMobileNavOpen((prev) => !prev)} />
      <div className="flex min-h-[calc(100vh-56px)]">
        <div className="hidden shrink-0 lg:block">
          <div className="sticky top-14 h-[calc(100vh-56px)] overflow-y-auto">
            <Sidebar role={role} activePath={pathname} />
          </div>
        </div>

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="relative z-50 h-full">
              <Sidebar
                role={role}
                activePath={pathname}
                onNavigate={() => setMobileNavOpen(false)}
                className="shadow-xl"
              />
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
