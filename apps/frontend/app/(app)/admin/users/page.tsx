'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, ErrorBanner, SkeletonRow, ConfirmDialog } from '@/components/ui';
import { fetchUsers, updateUserDisabled } from '@/lib/api';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchUsers({ limit: 50, role: role as User['role'] | '' }).then((res) => {
      if (!active) return;
      setError(null);
      setUsers(res.data ?? []);
      setLoading(false);
    }).catch((requestError) => {
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
    return users.filter((user) =>
      `${user.email} ${user.fullName}`.toLowerCase().includes(query)
    );
  }, [search, users]);

  async function toggleDisabled(user: User) {
    setBusy(true);
    try {
      const updated = await updateUserDisabled(user._id, !user.disabled);
      setError(null);
      setUsers((current) => current.map((item) => (item._id === user._id ? updated : item)));
      setTargetUser(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.updateUser'));
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
                  {user.disabled ? t('admin.users.status.disabled') : t('admin.users.status.active')}
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
    </div>
  );
}
