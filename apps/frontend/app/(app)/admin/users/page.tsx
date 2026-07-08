'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, ErrorBanner, SkeletonRow, ConfirmDialog } from '@/components/ui';
import { fetchUsers, updateUserDisabled } from '@/lib/api';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import type { User } from '@/types';

export default function AdminUsersPage() {
  const header = usePageHeader('adminUsers');
  const { t } = useTranslations();
  const [users, setUsers] = useState<User[]>([]);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchUsers({ limit: 50, role: role as User['role'] | '' })
      .then((res) => {
        if (!active) return;
        setError(null);
        setUsers(res.data ?? []);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : t('errors.updateUser'));
        setUsers([]);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [role]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) => `${user.email} ${user.fullName}`.toLowerCase().includes(query));
  }, [search, users]);

  async function toggleDisabled(user: User) {
    setBusy(true);
    try {
      const updated = await updateUserDisabled(user._id, !user.disabled);
      setUsers((current) => current.map((item) => (item._id === user._id ? updated : item)));
      setToast({
        message: user.disabled
          ? `Enabled user ${user.email} successfully.`
          : `Disabled user ${user.email} successfully.`,
        type: 'success',
      });
      setTargetUser(null);
    } catch (requestError) {
      setToast({
        message: requestError instanceof Error ? requestError.message : t('errors.updateUser'),
        type: 'error',
      });
      setTargetUser(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={header.title} subtitle={header.subtitle} />
      <div className="flex flex-wrap justify-end gap-2">
        <input
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          placeholder={t('common.search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          <option value="">{t('admin.users.allRoles')}</option>
          <option value="candidate">{t('roles.candidate')}</option>
          <option value="recruiter">{t('roles.recruiter')}</option>
          <option value="admin">{t('roles.admin')}</option>
        </select>
      </div>
      {loading ? <SkeletonRow /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!loading && !error ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="grid grid-cols-5 text-xs font-semibold text-[var(--text-3)]">
            <span>{t('admin.users.columns.email')}</span>
            <span>{t('admin.users.columns.fullName')}</span>
            <span>{t('admin.users.columns.role')}</span>
            <span>{t('admin.users.columns.status')}</span>
            <span>{t('admin.users.columns.actions')}</span>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            {filteredUsers.map((user) => (
              <div key={user._id} className="grid grid-cols-5 items-center">
                <span>{user.email}</span>
                <span>{user.fullName}</span>
                <span>{user.role}</span>
                <span>
                  {user.disabled
                    ? t('admin.users.status.disabled')
                    : t('admin.users.status.active')}
                </span>
                <span>
                  <button
                    className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs"
                    onClick={() => setTargetUser(user)}
                    disabled={busy}
                    type="button"
                  >
                    {user.disabled ? t('admin.users.enable') : t('admin.users.disable')}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(targetUser)}
        title={
          targetUser?.disabled
            ? t('dialogs.userStatus.enableTitle')
            : t('dialogs.userStatus.disableTitle')
        }
        description={t('dialogs.userStatus.description', {
          email: targetUser?.email ?? '',
        })}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        confirmVariant={targetUser?.disabled ? 'primary' : 'danger'}
        disabled={busy}
        onConfirm={() => (targetUser ? void toggleDisabled(targetUser) : undefined)}
        onCancel={() => setTargetUser(null)}
      />

      {toast ? (
        <div className="fixed top-6 right-6 z-50 flex w-96 max-w-[calc(100vw-3rem)] animate-in fade-in slide-in-from-right duration-300">
          <div className={`flex w-full items-start gap-3 rounded-xl p-4 shadow-xl backdrop-blur-md border ${
            toast.type === 'success' 
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800 shadow-emerald-100/50' 
              : 'bg-red-50/95 border-red-200 text-red-800 shadow-red-100/50'
          }`}>
            <span className="mt-0.5">
              {toast.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
            </span>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold">
                {toast.type === 'success' ? t('common.success') : t('common.error')}
              </p>
              <p className="text-xs opacity-90 leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Close notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
