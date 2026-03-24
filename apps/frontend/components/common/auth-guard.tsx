'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useAuth } from '@/lib/context/auth-context';

const PUBLIC_PATHS = new Set(['/','/login', '/signup']);

function canAccessPath(pathname: string, role?: string): boolean {
  const normalizedRole = String(role || '').toLowerCase();
  if (!pathname) return true;

  const isCandidateOrAdmin = normalizedRole === 'candidate' || normalizedRole === 'admin';

  if (pathname.startsWith('/settings')) {
    return normalizedRole === 'recruiter' || normalizedRole === 'admin';
  }

  if (pathname.startsWith('/profile')) {
    return isCandidateOrAdmin;
  }

  if (pathname.startsWith('/builder')) {
    return isCandidateOrAdmin;
  }

  if (pathname.startsWith('/tailor')) {
    return isCandidateOrAdmin;
  }

  if (pathname.startsWith('/resumes')) {
    return isCandidateOrAdmin;
  }

  return true;
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAuth();

  const isPublicPath = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (isLoading || isPublicPath || isAuthenticated) {
      return;
    }

    const next = encodeURIComponent(pathname || '/dashboard');
    router.replace(`/login?next=${next}`);
  }, [isLoading, isPublicPath, isAuthenticated, pathname, router]);

  useEffect(() => {
    if (isLoading || isPublicPath || !isAuthenticated) {
      return;
    }

    if (canAccessPath(pathname, user?.role)) {
      return;
    }

    router.replace('/dashboard');
  }, [isLoading, isPublicPath, isAuthenticated, pathname, user?.role, router]);

  if (isLoading && !isPublicPath) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0F0E8]">
        <p className="font-mono text-xs uppercase tracking-wide text-blue-700">Loading session...</p>
      </div>
    );
  }

  if (!isPublicPath && !isAuthenticated) {
    return null;
  }

  if (!isPublicPath && isAuthenticated && !canAccessPath(pathname, user?.role)) {
    return null;
  }

  return <>{children}</>;
}
