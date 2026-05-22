'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import BriefcaseBusiness from 'lucide-react/dist/esm/icons/briefcase-business';
import Building2 from 'lucide-react/dist/esm/icons/building-2';
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Gauge from 'lucide-react/dist/esm/icons/gauge';
import LayoutDashboard from 'lucide-react/dist/esm/icons/layout-dashboard';
import Settings from 'lucide-react/dist/esm/icons/settings';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import UserRound from 'lucide-react/dist/esm/icons/user-round';
import UsersRound from 'lucide-react/dist/esm/icons/users-round';
import type { LucideIcon } from 'lucide-react';

import { useAuth } from '@/lib/context/auth-context';

type NavItem = {
  href: string;
  label: string;
  helper: string;
  roles: string[];
  icon: LucideIcon;
};

const DEMO_UI_MODE = true;

const candidateNav: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Tổng quan',
    helper: 'CV và tín hiệu phù hợp',
    roles: ['candidate', 'admin'],
    icon: LayoutDashboard,
  },
  {
    href: '/flow',
    label: 'Ứng tuyển AI',
    helper: 'Ứng tuyển bằng CV tối ưu',
    roles: ['candidate', 'admin'],
    icon: Sparkles,
  },
  {
    href: '/builder',
    label: 'CV của tôi',
    helper: 'Trình dựng và phiên bản',
    roles: ['candidate', 'admin'],
    icon: FileText,
  },
  {
    href: '/tailor',
    label: 'Tối ưu CV',
    helper: 'Đối sánh JD và phản hồi',
    roles: ['candidate', 'admin'],
    icon: Gauge,
  },
  {
    href: '/profile',
    label: 'Hồ sơ',
    helper: 'Thông tin ứng viên',
    roles: ['candidate', 'admin'],
    icon: UserRound,
  },
];

const recruiterNav: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Tổng quan',
    helper: 'Không gian tuyển dụng',
    roles: ['recruiter', 'admin'],
    icon: LayoutDashboard,
  },
  {
    href: '/jobs',
    label: 'Tin tuyển dụng',
    helper: 'Vòng đời JD',
    roles: ['recruiter', 'admin'],
    icon: ClipboardList,
  },
  {
    href: '/applications',
    label: 'Ứng viên',
    helper: 'Xếp hạng theo hybridScore',
    roles: ['recruiter', 'admin'],
    icon: UsersRound,
  },
  {
    href: '/settings',
    label: 'Hồ sơ công ty',
    helper: 'Thiết lập LLM và công ty',
    roles: ['recruiter', 'admin'],
    icon: Building2,
  },
];

const adminNav: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Tổng quan',
    helper: 'Sức khỏe hệ thống',
    roles: ['admin'],
    icon: LayoutDashboard,
  },
  {
    href: '/settings',
    label: 'Thiết lập LLM',
    helper: 'Provider, model, API key',
    roles: ['admin'],
    icon: Settings,
  },
  {
    href: '/jobs',
    label: 'Tin tuyển dụng',
    helper: 'Giám sát JD',
    roles: ['admin'],
    icon: ClipboardList,
  },
  {
    href: '/applications',
    label: 'Ứng viên',
    helper: 'Pipeline và hybridScore',
    roles: ['admin'],
    icon: UsersRound,
  },
  {
    href: '/builder',
    label: 'CV mẫu',
    helper: 'Kiểm tra trình dựng CV',
    roles: ['admin'],
    icon: FileText,
  },
];

const demoNav: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Tổng quan',
    helper: 'Ma trận giao diện demo',
    roles: ['candidate', 'recruiter', 'admin'],
    icon: LayoutDashboard,
  },
  {
    href: '/jobs',
    label: 'Việc làm & JD',
    helper: 'Duyệt, tạo, cập nhật JD',
    roles: ['candidate', 'recruiter', 'admin'],
    icon: ClipboardList,
  },
  {
    href: '/applications',
    label: 'Ứng viên',
    helper: 'Xếp hạng theo hybridScore',
    roles: ['candidate', 'recruiter', 'admin'],
    icon: UsersRound,
  },
  {
    href: '/flow',
    label: 'Ứng tuyển AI',
    helper: 'Upload CV, tạo hồ sơ ứng tuyển',
    roles: ['candidate', 'recruiter', 'admin'],
    icon: Sparkles,
  },
  {
    href: '/builder',
    label: 'Resume Builder',
    helper: 'CV, mẫu, định dạng, PDF',
    roles: ['candidate', 'recruiter', 'admin'],
    icon: FileText,
  },
  {
    href: '/tailor',
    label: 'JD Match',
    helper: 'Feedback, cover letter, outreach',
    roles: ['candidate', 'recruiter', 'admin'],
    icon: Gauge,
  },
  {
    href: '/profile',
    label: 'Hồ sơ cá nhân',
    helper: 'Thông tin ứng viên mẫu',
    roles: ['candidate', 'recruiter', 'admin'],
    icon: UserRound,
  },
  {
    href: '/settings',
    label: 'Admin & LLM',
    helper: 'Systemconfigs, privacy, ngôn ngữ',
    roles: ['candidate', 'recruiter', 'admin'],
    icon: Settings,
  },
];

export function SideNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const role = user?.role || 'candidate';
  const isRecruiter = role === 'recruiter';
  const isAdmin = role === 'admin';
  const navItems = (
    DEMO_UI_MODE ? demoNav : isAdmin ? adminNav : isRecruiter ? recruiterNav : candidateNav
  ).filter((item) => item.roles.includes(DEMO_UI_MODE ? 'candidate' : role));
  const roleLabel = isRecruiter
    ? 'Nhà tuyển dụng'
    : role === 'admin'
      ? 'Quản trị viên'
      : 'Ứng viên';
  const email = user?.email || (isRecruiter ? 'talent@company.com' : 'candidate@email.com');

  return (
    <aside className="hidden h-screen border-r border-[color:var(--border)] bg-white lg:sticky lg:top-0 lg:flex lg:flex-col">
      <div className="flex h-full flex-col px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[var(--blue-900)] font-mono text-sm font-bold text-white shadow-[0_12px_24px_rgba(15,31,92,0.20)]">
            CV
          </span>
          <span>
            <span className="block text-base font-bold text-[var(--text-1)]">CV Matching</span>
            <span className="block text-xs font-medium text-[var(--text-2)]">
              Nền tảng tuyển dụng AI
            </span>
          </span>
        </Link>

        <nav className="mt-8 flex-1 space-y-1" aria-label={`Điều hướng ${roleLabel}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'group flex min-h-14 items-center gap-3 rounded-[8px] px-3 py-2.5 transition-colors',
                  active
                    ? 'bg-[var(--blue-100)] text-[var(--blue-900)]'
                    : 'text-[var(--text-2)] hover:bg-slate-50 hover:text-[var(--text-1)]'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{item.label}</span>
                  <span className="block truncate text-xs text-[var(--text-3)]">{item.helper}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div
          className={clsx(
            'rounded-[12px] border p-4',
            isRecruiter
              ? 'border-[rgba(201,168,76,0.45)] bg-[var(--gold-dim)]'
              : 'border-[color:var(--border)] bg-[var(--bg)]'
          )}
        >
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-2)]">
            {roleLabel}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--text-1)]">{email}</p>
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[var(--blue-700)]">
            <BriefcaseBusiness className="h-3.5 w-3.5" aria-hidden="true" />
            {isAdmin
              ? 'Trung tâm quản trị'
              : isRecruiter
                ? 'Trung tâm tuyển dụng'
                : 'Không gian nghề nghiệp'}
          </div>
        </div>
      </div>
    </aside>
  );
}
