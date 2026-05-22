'use client';
import { usePathname } from 'next/navigation';
import { AuthBar } from '@/components/common/auth-bar';
import { SideNav } from '@/components/common/side-nav';

const PUBLIC_PATHS = new Set(['/', '/login', '/signup', '/forgot-password', '/reset-password']);

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  if (isPublicPath) {
    return <main className="min-h-screen app-shell">{children}</main>;
  }

  return (
    <div className="min-h-screen flex flex-col app-shell">
      <AuthBar />
      <div className="flex flex-1">
        <SideNav />
        <main className="flex min-h-[calc(100vh-72px)] flex-1 flex-col px-6 py-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
