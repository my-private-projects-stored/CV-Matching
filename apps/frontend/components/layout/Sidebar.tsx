'use client';

import Link from 'next/link';
import type { UserRole } from '@/types';
import { canonicalizeRole, type CanonicalRole } from '@/lib/auth/roles';
import { useAuth } from '@/lib/context/auth-context';
import { useTranslations } from '@/lib/i18n/translations';
import { cn } from '@/lib/utils';

type NavGroup = { groupKey: string; items: Array<{ labelKey: string; href: string }> };

const navConfig: Record<CanonicalRole, NavGroup[]> = {
  candidate: [
    {
      groupKey: 'nav.groups.workspace',
      items: [
        { labelKey: 'nav.candidate.overview', href: '/candidate/dashboard' },
        { labelKey: 'nav.candidate.applications', href: '/candidate/applications' },
        { labelKey: 'nav.candidate.resumes', href: '/candidate/resumes' },
        { labelKey: 'nav.candidate.jobs', href: '/candidate/jobs' },
        { labelKey: 'nav.candidate.recommendations', href: '/candidate/recommendations' },
        { labelKey: 'nav.candidate.optimize', href: '/candidate/optimize' },
        { labelKey: 'nav.candidate.practiceInterview', href: '/candidate/practice-interview' },
      ],
    },
    {
      groupKey: 'nav.groups.account',
      items: [
        { labelKey: 'nav.candidate.notifications', href: '/candidate/notifications' },
        { labelKey: 'nav.candidate.profile', href: '/candidate/profile' },
        { labelKey: 'nav.candidate.settings', href: '/candidate/settings' },
      ],
    },
  ],
  recruiter: [
    {
      groupKey: 'nav.groups.workspace',
      items: [
        { labelKey: 'nav.recruiter.overview', href: '/recruiter/dashboard' },
        { labelKey: 'nav.recruiter.jobs', href: '/recruiter/jobs' },
        { labelKey: 'nav.recruiter.candidates', href: '/recruiter/candidates' },
      ],
    },
    {
      groupKey: 'nav.groups.account',
      items: [
        { labelKey: 'nav.recruiter.notifications', href: '/recruiter/notifications' },
        { labelKey: 'nav.recruiter.company', href: '/recruiter/company' },
        { labelKey: 'nav.recruiter.settings', href: '/recruiter/settings' },
      ],
    },
  ],
  tech_staff: [
    {
      groupKey: 'nav.groups.system',
      items: [
        { labelKey: 'nav.admin.health', href: '/admin/health' },
        { labelKey: 'nav.admin.queues', href: '/admin/queues' },
        { labelKey: 'nav.admin.auditLogs', href: '/admin/audit-logs' },
        { labelKey: 'nav.admin.config', href: '/admin/config' },
        { labelKey: 'nav.admin.users', href: '/admin/users' },
        { labelKey: 'nav.admin.vectors', href: '/admin/vectors' },
      ],
    },
  ],
  platform_owner: [
    {
      groupKey: 'nav.groups.owner',
      items: [
        { labelKey: 'nav.owner.dashboard', href: '/owner/dashboard' },
        { labelKey: 'nav.owner.funnel', href: '/owner/funnel' },
      ],
    },
  ],
};

export function Sidebar({ role, activePath }: { role: UserRole; activePath?: string }) {
  const { t } = useTranslations();
  const { user } = useAuth();
  const userEmail = user?.email ?? t('common.guest');
  const resolvedRole: CanonicalRole = canonicalizeRole(role) ?? 'candidate';
  const groups = navConfig[resolvedRole];

  return (
    <aside className="flex h-full w-56 flex-col border-r border-[var(--border)] bg-white px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--gold)] font-mono text-xs text-[var(--blue-900)]">
          CV
        </span>
        <span className="text-sm font-semibold">{t('app.name')}</span>
      </div>
      <nav className="flex-1 space-y-6">
        {groups.map((group) => (
          <div key={group.groupKey}>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-3)]">
              {t(group.groupKey)}
            </p>
            <div className="mt-2 space-y-1">
              {group.items.map((item) => {
                const isActive =
                  activePath === item.href || Boolean(activePath?.startsWith(`${item.href}/`));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'block rounded-lg px-3 py-2 text-sm text-[var(--text-2)]',
                      isActive &&
                        'border-r-2 border-[var(--blue-700)] bg-[var(--blue-50)] font-semibold text-[var(--blue-700)]'
                    )}
                  >
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="rounded-lg bg-[var(--blue-50)] px-3 py-2 text-xs text-[var(--text-2)]">
        <p className="font-semibold capitalize text-[var(--blue-700)]">
          {t(`roles.${resolvedRole}`)}
        </p>
        <p className="truncate" title={userEmail}>
          {userEmail}
        </p>
      </div>
    </aside>
  );
}
