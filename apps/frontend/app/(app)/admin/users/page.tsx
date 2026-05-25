'use client';

import { useEffect, useState } from 'react';
import { PageHeader, ErrorBanner, SkeletonRow } from '@/components/ui';
import { getList, putOne } from '@/lib/api';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';
import type { User } from '@/types';

export default function AdminUsersPage() {
  const header = usePageHeader('adminUsers');
  const { t } = useTranslations();
  const [users, setUsers] = useState<User[]>([]);
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getList<User>('users', { limit: 50, role }).then((res) => {
      if (!active) return;
      if (res.error) {
        setError(res.error);
        setUsers([]);
      } else {
        setError(null);
        setUsers(res.data ?? []);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [role]);

  async function toggleDisabled(user: User) {
    const res = await putOne<User, { disabled: boolean }>('users', user._id, {
      disabled: !user.disabled,
    });

    if (res.error || !res.data) {
      setError(res.error || t('errors.updateUser'));
      return;
    }

    setError(null);
    setUsers((current) => current.map((item) => (item._id === user._id ? res.data! : item)));
  }

  return (
    <div className="space-y-6">
      <PageHeader title={header.title} subtitle={header.subtitle} />
      <div className="flex justify-end">
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
            {users.map((user) => (
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
                    onClick={() => toggleDisabled(user)}
                  >
                    {user.disabled ? t('admin.users.enable') : t('admin.users.disable')}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
