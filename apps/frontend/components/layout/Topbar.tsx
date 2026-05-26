'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, LogOut } from 'lucide-react';
import { NotificationPanel } from '@/components/ui/NotificationPanel';
import { useAuth } from '@/lib/context/auth-context';
import { useTranslations } from '@/lib/i18n/translations';
import { UiLanguageSwitcher } from '@/components/ui/UiLanguageSwitcher';

export function Topbar({ breadcrumb, right }: { breadcrumb?: string; right?: ReactNode }) {
  const { t } = useTranslations();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const canUseNotifications = user?.role === 'candidate' || user?.role === 'recruiter';

  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--border)] bg-white px-6">
      <div className="flex items-center gap-2 text-sm text-[var(--text-2)]">
        <span className="font-semibold text-[var(--text-1)]">{t('app.name')}</span>
        {breadcrumb ? <span className="text-[var(--text-3)]">/ {breadcrumb}</span> : null}
      </div>
      <div className="flex items-center gap-3">
        {right}
        {canUseNotifications ? (
          <div className="relative">
            <button
              type="button"
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--text-2)] hover:text-[var(--blue-700)]"
              onClick={() => setNotificationOpen((current) => !current)}
              aria-label={t('common.notifications')}
            >
              <Bell className="size-4" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 rounded-full bg-[var(--danger)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </button>
            <NotificationPanel
              open={notificationOpen}
              onClose={() => setNotificationOpen(false)}
              role={user.role}
              unreadCount={unreadCount}
              onUnreadCountChange={setUnreadCount}
            />
          </div>
        ) : null}
        <UiLanguageSwitcher className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs text-[var(--text-2)] cursor-pointer focus:outline-none" />
        <div className="flex items-center gap-2 rounded-full border border-[var(--border)] px-2 py-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--blue-100)] text-xs font-semibold text-[var(--blue-700)]">
            {(user?.full_name || user?.email || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="hidden max-w-44 md:block">
            <p className="truncate text-xs font-semibold text-[var(--text-1)]">
              {user?.full_name || user?.email || t('common.guest')}
            </p>
            <p className="truncate text-[10px] text-[var(--text-3)]">
              {user?.role ? t(`roles.${user.role}`) : ''}
            </p>
          </div>
          <button
            type="button"
            className="rounded-full p-1 text-[var(--text-3)] hover:bg-[var(--blue-50)] hover:text-[var(--blue-700)]"
            onClick={() => {
              signOut();
              router.replace('/login');
            }}
            aria-label={t('common.logout')}
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
