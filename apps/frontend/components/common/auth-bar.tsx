'use client';

import { usePathname, useRouter } from 'next/navigation';
import Bell from 'lucide-react/dist/esm/icons/bell';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import LogOut from 'lucide-react/dist/esm/icons/log-out';
import Search from 'lucide-react/dist/esm/icons/search';

import { useAuth } from '@/lib/context/auth-context';

const pathLabels: Record<string, string> = {
  dashboard: 'Tổng quan',
  flow: 'Ứng tuyển AI',
  builder: 'CV của tôi',
  tailor: 'Tối ưu CV',
  applications: 'Ứng viên',
  jobs: 'Tin tuyển dụng',
  profile: 'Hồ sơ',
  settings: 'Thiết lập LLM',
};

const roleLabels: Record<string, string> = {
  candidate: 'Ứng viên',
  recruiter: 'Nhà tuyển dụng',
  admin: 'Quản trị viên',
};

export function AuthBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const segments = pathname?.split('/').filter(Boolean) || [];
  const initials = (user?.full_name || user?.email || 'CV')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[rgba(248,247,244,0.88)] backdrop-blur">
      <div className="flex h-[72px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="hidden min-w-0 items-center gap-2 text-sm font-semibold text-[var(--text-2)] md:flex">
          <span className="text-[var(--text-1)]">CV Matching</span>
          {segments.length ? (
            <ChevronRight className="h-4 w-4 text-[var(--text-3)]" aria-hidden="true" />
          ) : null}
          {segments.map((segment, index) => (
            <span key={`${segment}-${index}`} className="flex min-w-0 items-center gap-2">
              <span
                className={
                  index === segments.length - 1 ? 'truncate text-[var(--blue-700)]' : 'truncate'
                }
              >
                {pathLabels[segment] || segment}
              </span>
              {index < segments.length - 1 ? (
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-[var(--text-3)]"
                  aria-hidden="true"
                />
              ) : null}
            </span>
          ))}
        </div>

        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[7px] border border-[color:var(--border)] bg-white px-3 text-sm text-[var(--text-2)] md:max-w-[420px]">
          <Search className="h-4 w-4 shrink-0 text-[var(--text-3)]" aria-hidden="true" />
          <input
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--text-3)]"
            placeholder="Tìm ứng viên, tin tuyển dụng, kỹ năng..."
            type="search"
            aria-label="Tìm ứng viên, tin tuyển dụng, kỹ năng"
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-[7px] border border-[color:var(--border)] bg-white text-[var(--text-2)] hover:text-[var(--text-1)]"
            aria-label="Thông báo"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="hidden items-center gap-2 rounded-[9px] border border-[color:var(--border)] bg-white px-2 py-1.5 sm:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-[var(--blue-900)] font-mono text-xs font-bold text-white">
              {initials || 'CV'}
            </span>
            <span className="min-w-0">
              <span className="block max-w-[150px] truncate text-xs font-bold text-[var(--text-1)]">
                {user?.full_name || user?.email}
              </span>
              <span className="block text-[11px] text-[var(--text-2)]">
                {roleLabels[user?.role || 'candidate'] || 'Người dùng'}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              signOut();
              router.replace('/login');
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[7px] border border-[color:var(--border)] bg-white px-3 text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text-1)]"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:inline">Đăng xuất</span>
          </button>
        </div>
      </div>
    </header>
  );
}
