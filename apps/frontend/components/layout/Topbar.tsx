'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, LogOut, Menu, X } from 'lucide-react';
import { NotificationPanel } from '@/components/ui/NotificationPanel';
import { canonicalizeRole } from '@/lib/auth/roles';
import { useAuth } from '@/lib/context/auth-context';
import { useNotificationStream } from '@/lib/hooks/use-notification-stream';
import { useTranslations } from '@/lib/i18n/translations';
import { UiLanguageSwitcher } from '@/components/ui/UiLanguageSwitcher';
import type { NotificationItem } from '@/lib/api/notifications';

export function Topbar({
  breadcrumb,
  right,
  onMenuToggle,
}: {
  breadcrumb?: string;
  right?: ReactNode;
  onMenuToggle?: () => void;
}) {
  const { t } = useTranslations();
  const { user, accessToken, signOut } = useAuth();
  const router = useRouter();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [liveToast, setLiveToast] = useState<NotificationItem | null>(null);

  const canonicalRole = canonicalizeRole(user?.role);
  const canUseNotifications = canonicalRole === 'candidate' || canonicalRole === 'recruiter';
  const breadcrumbLabel =
    breadcrumb === 'candidate'
      ? t('roles.candidate')
      : breadcrumb === 'recruiter'
        ? t('roles.recruiter')
        : breadcrumb === 'admin'
          ? t('roles.tech_staff')
          : breadcrumb === 'owner'
            ? t('roles.platform_owner')
            : breadcrumb;

  const handleStreamNotification = useCallback((item: NotificationItem) => {
    setUnreadCount((prev) => prev + 1);
    setLiveToast(item);
  }, []);

  useNotificationStream({
    enabled: canUseNotifications,
    accessToken,
    onNotification: handleStreamNotification,
  });

  useEffect(() => {
    if (!liveToast) return;
    const timer = window.setTimeout(() => setLiveToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [liveToast]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--border)] bg-white/90 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-2.5 text-sm text-[var(--text-2)]">
        {onMenuToggle ? (
          <button
            type="button"
            onClick={onMenuToggle}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-white text-[var(--text-2)] hover:text-[var(--blue-700)] lg:hidden"
            aria-label="Toggle navigation"
          >
            <Menu className="size-4" />
          </button>
        ) : null}
        <span className="font-semibold text-[var(--text-1)]">{t('app.name')}</span>
        {breadcrumbLabel ? (
          <span className="hidden text-[var(--text-3)] sm:inline">/ {breadcrumbLabel}</span>
        ) : null}
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
              role={canonicalRole ?? 'candidate'}
              unreadCount={unreadCount}
              onUnreadCountChange={setUnreadCount}
            />
          </div>
        ) : null}
        <UiLanguageSwitcher className="cursor-pointer rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs text-[var(--text-2)] focus:outline-none" />
        <div className="flex items-center gap-2 rounded-full border border-[var(--border)] px-2 py-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--blue-100)] text-xs font-semibold text-[var(--blue-700)]">
            {(user?.full_name || user?.email || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="hidden max-w-44 md:block">
            <p className="truncate text-xs font-semibold text-[var(--text-1)]">
              {user?.full_name || user?.email || t('common.guest')}
            </p>
            <p className="truncate text-[10px] text-[var(--text-3)]">
              {canonicalRole ? t(`roles.${canonicalRole}`) : ''}
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

      {liveToast ? (
        <div className="fixed right-6 top-16 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-[var(--blue-200)] bg-white p-4 shadow-lg">
          <Bell className="mt-0.5 size-4 shrink-0 text-[var(--blue-700)]" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--text-1)]">{liveToast.title}</p>
            <p className="mt-0.5 text-xs text-[var(--text-2)]">{liveToast.body}</p>
          </div>
          <button
            type="button"
            className="text-[var(--text-3)] hover:text-[var(--text-1)]"
            onClick={() => setLiveToast(null)}
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}
    </header>
  );
}
