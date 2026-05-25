import type { UserRole } from '@/types';
import { cn } from '@/lib/utils';

const navConfig: Record<
  UserRole,
  Array<{ group: string; items: Array<{ label: string; href: string }> }>
> = {
  candidate: [
    {
      group: 'Workspace',
      items: [
        { label: 'Overview', href: '/candidate/dashboard' },
        { label: 'AI Applications', href: '/candidate/applications' },
        { label: 'My Resumes', href: '/candidate/resumes' },
        { label: 'Browse Jobs', href: '/candidate/jobs' },
        { label: 'Optimize CV', href: '/candidate/optimize' },
      ],
    },
    {
      group: 'Account',
      items: [
        { label: 'Profile', href: '/candidate/profile' },
        { label: 'Settings', href: '/candidate/settings' },
      ],
    },
  ],
  recruiter: [
    {
      group: 'Workspace',
      items: [
        { label: 'Overview', href: '/recruiter/dashboard' },
        { label: 'Job Postings', href: '/recruiter/jobs' },
        { label: 'Candidates', href: '/recruiter/candidates' },
      ],
    },
    {
      group: 'Account',
      items: [
        { label: 'Company Profile', href: '/recruiter/company' },
        { label: 'Settings', href: '/recruiter/settings' },
      ],
    },
  ],
  admin: [
    {
      group: 'System',
      items: [
        { label: 'Config', href: '/admin/config' },
        { label: 'Users', href: '/admin/users' },
      ],
    },
  ],
};

export function Sidebar({ role, activePath }: { role: UserRole; activePath?: string }) {
  return (
    <aside className="flex h-full w-56 flex-col border-r border-[var(--border)] bg-white px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--gold)] font-mono text-xs text-[var(--blue-900)]">
          CV
        </span>
        <span className="text-sm font-semibold">CV Matching</span>
      </div>
      <nav className="flex-1 space-y-6">
        {navConfig[role].map((group) => (
          <div key={group.group}>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-3)]">
              {group.group}
            </p>
            <div className="mt-2 space-y-1">
              {group.items.map((item) => {
                const isActive = activePath === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'block rounded-lg px-3 py-2 text-sm text-[var(--text-2)]',
                      isActive &&
                        'border-r-2 border-[var(--blue-700)] bg-[var(--blue-50)] font-semibold text-[var(--blue-700)]'
                    )}
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="rounded-lg bg-[var(--blue-50)] px-3 py-2 text-xs text-[var(--text-2)]">
        <p className="font-semibold capitalize text-[var(--blue-700)]">{role}</p>
        <p>demo@cvmatching.io</p>
      </div>
    </aside>
  );
}
