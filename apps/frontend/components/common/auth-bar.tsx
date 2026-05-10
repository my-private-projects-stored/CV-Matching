'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

import { useAuth } from '@/lib/context/auth-context';

const PUBLIC_AUTH_PATHS = new Set(['/login', '/signup', '/forgot-password', '/reset-password']);

export function AuthBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, signOut } = useAuth();

  const isAuthPage = pathname ? PUBLIC_AUTH_PATHS.has(pathname) : false;

  const handleLogout = () => {
    signOut();
    router.replace('/login');
  };

  return (
    <div className="sticky top-0 z-[100] border-b border-[color:var(--border)] bg-[var(--surface-glass)] backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-6 py-4">
        <div className="min-w-0">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-white text-sm font-semibold">
              AI
            </span>
            <div>
              <p className="font-[var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
                CV Matching Platform
              </p>
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--text-subtle)]">
                Talent Intelligence Suite
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <div className="hidden rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-xs font-semibold text-[color:var(--text-muted)] md:block">
                {user?.full_name} · {user?.role}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-white px-5 text-xs font-semibold text-[var(--foreground)] shadow-[0_6px_14px_rgba(15,27,45,0.12)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_18px_rgba(15,27,45,0.2)]"
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-white px-5 text-xs font-semibold text-[var(--foreground)] shadow-[0_6px_14px_rgba(15,27,45,0.12)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_18px_rgba(15,27,45,0.2)]"
              >
                Đăng nhập
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-9 items-center justify-center rounded-full bg-[var(--primary)] px-5 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(21,94,239,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(21,94,239,0.45)]"
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}