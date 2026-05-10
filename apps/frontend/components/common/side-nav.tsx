'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

import { useAuth } from '@/lib/context/auth-context';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Tổng quan', roles: ['candidate', 'recruiter', 'admin'] },
  { href: '/flow', label: 'Ứng tuyển AI', roles: ['candidate', 'admin'] },
  { href: '/builder', label: 'Hồ sơ CV', roles: ['candidate', 'admin'] },
  { href: '/tailor', label: 'Tối ưu CV', roles: ['candidate', 'admin'] },
  { href: '/applications', label: 'Ứng viên', roles: ['recruiter', 'admin', 'candidate'] },
  { href: '/jobs', label: 'Tin tuyển dụng', roles: ['recruiter', 'admin'] },
  { href: '/profile', label: 'Hồ sơ cá nhân', roles: ['candidate', 'admin'] },
  { href: '/settings', label: 'Thiết lập', roles: ['recruiter', 'admin'] },
];

const ROLE_LABELS: Record<string, string> = {
  candidate: 'Ứng viên',
  recruiter: 'Nhà tuyển dụng',
  admin: 'Quản trị',
};

export function SideNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const role = user?.role || 'candidate';

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside className="hidden w-64 shrink-0 border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] text-[var(--sidebar-foreground)] lg:block">
      <div className="flex h-full flex-col px-5 py-6">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--text-subtle)]">
            Workspace
          </p>
          <p className="mt-2 text-lg font-semibold text-white">
            {ROLE_LABELS[role] || 'Người dùng'}
          </p>
          <p className="text-xs text-[color:var(--text-subtle)]">
            {user?.full_name || 'CV Matching Platform'}
          </p>
        </div>

        <nav className="flex-1 space-y-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-[var(--sidebar-primary)] text-white shadow-[0_8px_18px_rgba(21,94,239,0.35)]'
                    : 'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-white'
                )}
              >
                <span>{item.label}</span>
                {isActive ? (
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/70">Active</span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 rounded-lg border border-white/10 bg-white/5 px-3 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">AI Insights</p>
          <p className="mt-2 text-sm text-white">
            Ưu tiên ứng viên dựa trên điểm phù hợp và tín hiệu kỹ năng.
          </p>
        </div>
      </div>
    </aside>
  );
}
