'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { AuthBar } from '@/components/common/auth-bar';
import { SideNav } from '@/components/common/side-nav';

const PUBLIC_PATHS = new Set(['/', '/login', '/signup', '/forgot-password', '/reset-password']);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicPath = PUBLIC_PATHS.has(pathname || '/');

  if (isPublicPath) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen app-shell lg:grid lg:grid-cols-[272px_1fr]">
      <div className="lg:row-span-2">
        <SideNav />
      </div>
      <AuthBar />
      <main className="flex min-h-[calc(100vh-72px)] flex-col px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col">{children}</div>
      </main>
    </div>
  );
}
