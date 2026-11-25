'use client';

import Link from 'next/link';
import {
  Activity,
  Bell,
  Briefcase,
  Building2,
  ClipboardList,
  Database,
  FileText,
  Filter,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  User,
  Users,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/types';
import { canonicalizeRole, type CanonicalRole } from '@/lib/auth/roles';
import { useAuth } from '@/lib/context/auth-context';
import { useTranslations } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';

type NavItem = { labelKey: string; href: string; icon: LucideIcon };
type NavGroup = { groupKey: string; items: NavItem[] };

const navConfig: Record<CanonicalRole, NavGroup[]> = {
  candidate: [
    {
      groupKey: 'nav.groups.workspace',
      items: [
        { labelKey: 'nav.candidate.overview', href: '/candidate/dashboard', icon: LayoutDashboard },
        {
          labelKey: 'nav.candidate.applications',
          href: '/candidate/applications',
          icon: ClipboardList,
        },
        { labelKey: 'nav.candidate.resumes', href: '/candidate/resumes', icon: FileText },
        { labelKey: 'nav.candidate.jobs', href: '/candidate/jobs', icon: Briefcase },
        {
          labelKey: 'nav.candidate.recommendations',
          href: '/candidate/recommendations',
          icon: Sparkles,
        },
        { labelKey: 'nav.candidate.optimize', href: '/candidate/optimize', icon: Wand2 },
        {
          labelKey: 'nav.candidate.practiceInterview',
          href: '/candidate/practice-interview',
          icon: MessageSquare,
        },
      ],
    },
    {
      groupKey: 'nav.groups.account',
      items: [
        { labelKey: 'nav.candidate.notifications', href: '/candidate/notifications', icon: Bell },
        { labelKey: 'nav.candidate.profile', href: '/candidate/profile', icon: User },
        { labelKey: 'nav.candidate.settings', href: '/candidate/settings', icon: Settings },
      ],
    },
  ],
  recruiter: [
    {
      groupKey: 'nav.groups.workspace',
      items: [
        { labelKey: 'nav.recruiter.overview', href: '/recruiter/dashboard', icon: LayoutDashboard },
        { labelKey: 'nav.recruiter.jobs', href: '/recruiter/jobs', icon: Briefcase },
        { labelKey: 'nav.recruiter.candidates', href: '/recruiter/candidates', icon: Users },
      ],
    },
    {
      groupKey: 'nav.groups.account',
      items: [
        { labelKey: 'nav.recruiter.notifications', href: '/recruiter/notifications', icon: Bell },
        { labelKey: 'nav.recruiter.company', href: '/recruiter/company', icon: Building2 },
        { labelKey: 'nav.recruiter.settings', href: '/recruiter/settings', icon: Settings },
      ],
    },
  ],
  tech_staff: [
    {
      groupKey: 'nav.groups.system',
      items: [
        { labelKey: 'nav.admin.health', href: '/admin/health', icon: Activity },
        { labelKey: 'nav.admin.queues', href: '/admin/queues', icon: ListTodo },
        { labelKey: 'nav.admin.auditLogs', href: '/admin/audit-logs', icon: ScrollText },
        { labelKey: 'nav.admin.config', href: '/admin/config', icon: SlidersHorizontal },
        { labelKey: 'nav.admin.users', href: '/admin/users', icon: Users },
        { labelKey: 'nav.admin.vectors', href: '/admin/vectors', icon: Database },
      ],
    },
  ],
  platform_owner: [
    {
      groupKey: 'nav.groups.owner',
      items: [
        { labelKey: 'nav.owner.dashboard', href: '/owner/dashboard', icon: TrendingUp },
        { labelKey: 'nav.owner.funnel', href: '/owner/funnel', icon: Filter },
      ],
    },
  ],
};

export function Sidebar({
  role,
  activePath,
  onNavigate,
  className,
}: {
  role: UserRole;
  activePath?: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const { t } = useTranslations();
  const { user } = useAuth();
  const userEmail = user?.email ?? t('common.guest');
  const resolvedRole: CanonicalRole = canonicalizeRole(role) ?? 'candidate';
  const groups = navConfig[resolvedRole];

  return (
    <aside
      className={cn(
        'flex h-full w-60 flex-col border-r border-[var(--border)] bg-white px-4 py-5',
        className
      )}
    >
      <div className="mb-6 flex items-center gap-2.5 px-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--gold)] font-mono text-xs font-bold text-[var(--blue-900)] shadow-sm">
          CV
        </span>
        <span className="text-sm font-semibold tracking-tight text-[var(--text-1)]">
          {t('app.name')}
        </span>
      </div>
      <nav className="flex-1 space-y-6">
        {groups.map((group) => (
          <div key={group.groupKey}>
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-3)]">
              {t(group.groupKey)}
            </p>
            <div className="mt-2 space-y-1">
              {group.items.map((item) => {
                const isActive =
                  activePath === item.href || Boolean(activePath?.startsWith(`${item.href}/`));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[var(--text-2)] transition-colors',
                      'hover:bg-slate-50 hover:text-[var(--text-1)]',
                      isActive &&
                        'bg-[var(--blue-50)] font-semibold text-[var(--blue-700)] shadow-[inset_3px_0_0_0_var(--blue-700)] hover:bg-[var(--blue-50)] hover:text-[var(--blue-700)]'
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-4 shrink-0',
                        isActive ? 'text-[var(--blue-700)]' : 'text-[var(--text-3)]'
                      )}
                    />
                    <span className="truncate">{t(item.labelKey)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-4 rounded-xl border border-[var(--blue-100)] bg-[var(--blue-50)]/70 px-3 py-2.5 text-xs text-[var(--text-2)]">
        <p className="font-semibold capitalize text-[var(--blue-700)]">
          {t(`roles.${resolvedRole}`)}
        </p>
        <p className="mt-0.5 truncate" title={userEmail}>
          {userEmail}
        </p>
      </div>
    </aside>
  );
}
