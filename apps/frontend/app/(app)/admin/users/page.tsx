'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, ErrorBanner, SkeletonRow } from '@/components/ui';
import {
  fetchCompanies,
  fetchUsers,
  suspendUser,
  unsuspendUser,
  updateUserRole,
  verifyCompany,
  type CompanyProfile,
} from '@/lib/api';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import type { User, UserRole } from '@/types';

const ROLE_OPTIONS: UserRole[] = ['candidate', 'recruiter', 'tech_staff', 'platform_owner'];

export default function AdminUsersPage() {
  const header = usePageHeader('adminUsers');
  const { t } = useTranslations();
  const [activeTab, setActiveTab] = useState<'users' | 'companies'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [suspendTarget, setSuspendTarget] = useState<User | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    if (activeTab === 'users') {
      fetchUsers({ limit: 50, role: role as User['role'] | '' })
        .then((res) => {
          if (!active) return;
          setError(null);
          setUsers(res.data ?? []);
        })
        .catch((requestError) => {
          if (!active) return;
          setError(requestError instanceof Error ? requestError.message : t('errors.updateUser'));
          setUsers([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      fetchCompanies()
        .then((list) => {
          if (!active) return;
          setError(null);
          setCompanies(list);
        })
        .catch((requestError) => {
          if (!active) return;
          setError(
            requestError instanceof Error ? requestError.message : t('errors.loadCompanyProfile')
          );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [activeTab, role, t]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) => `${user.email} ${user.fullName}`.toLowerCase().includes(query));
  }, [search, users]);

  async function handleSuspendSubmit() {
    if (!suspendTarget || !suspendReason.trim()) return;
    setBusy(true);
    try {
      const updated = await suspendUser(suspendTarget._id, suspendReason.trim());
      setUsers((current) =>
        current.map((item) => (item._id === suspendTarget._id ? updated : item))
      );
      setToast({ message: `Suspended ${suspendTarget.email}`, type: 'success' });
      setSuspendTarget(null);
      setSuspendReason('');
    } catch (requestError) {
      setToast({
        message: requestError instanceof Error ? requestError.message : t('errors.updateUser'),
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleUnsuspend(user: User) {
    setBusy(true);
    try {
      const updated = await unsuspendUser(user._id);
      setUsers((current) => current.map((item) => (item._id === user._id ? updated : item)));
      setToast({ message: `Enabled ${user.email}`, type: 'success' });
    } catch (requestError) {
      setToast({
        message: requestError instanceof Error ? requestError.message : t('errors.updateUser'),
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(user: User, nextRole: UserRole) {
    setBusy(true);
    try {
      const updated = await updateUserRole(user._id, nextRole, 'Updated via tech_staff portal');
      setUsers((current) => current.map((item) => (item._id === user._id ? updated : item)));
      setToast({ message: `Updated ${user.email} role to ${nextRole}`, type: 'success' });
    } catch (requestError) {
      setToast({
        message: requestError instanceof Error ? requestError.message : t('errors.updateUser'),
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCompany(companyId: string, status: 'verified' | 'rejected') {
    setBusy(true);
    try {
      const updated = await verifyCompany(companyId, status);
      setCompanies((current) => current.map((c) => (c.id === companyId ? updated : c)));
      setToast({ message: `Company ${status}`, type: 'success' });
    } catch (requestError) {
      setToast({
        message: requestError instanceof Error ? requestError.message : t('errors.saveCompany'),
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={header.title} subtitle={header.subtitle} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              activeTab === 'users'
                ? 'border-[var(--blue-700)] bg-[var(--blue-50)] text-[var(--blue-700)]'
                : 'border-[var(--border)] bg-white'
            }`}
          >
            {t('admin.users.usersTab')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('companies')}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              activeTab === 'companies'
                ? 'border-[var(--blue-700)] bg-[var(--blue-50)] text-[var(--blue-700)]'
                : 'border-[var(--border)] bg-white'
            }`}
          >
            {t('admin.users.companiesTab')}
          </button>
        </div>

        {activeTab === 'users' ? (
          <div className="flex flex-wrap gap-2">
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
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {loading ? <SkeletonRow /> : null}
      {error ? <ErrorBanner message={error} /> : null}

      {!loading && !error && activeTab === 'users' ? (
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
              <div key={user._id} className="grid grid-cols-5 items-center gap-2">
                <span className="truncate">{user.email}</span>
                <span className="truncate">{user.fullName}</span>
                <span>
                  <select
                    className="rounded-md border border-[var(--border)] px-2 py-1 text-xs"
                    value={user.role === 'admin' ? 'tech_staff' : user.role}
                    disabled={busy}
                    onChange={(e) => void handleRoleChange(user, e.target.value as UserRole)}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </span>
                <span>
                  {user.disabled
                    ? t('admin.users.status.disabled')
                    : t('admin.users.status.active')}
                </span>
                <span>
                  {user.disabled ? (
                    <button
                      className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs"
                      onClick={() => void handleUnsuspend(user)}
                      disabled={busy}
                      type="button"
                    >
                      {t('admin.users.enable')}
                    </button>
                  ) : (
                    <button
                      className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700"
                      onClick={() => {
                        setSuspendTarget(user);
                        setSuspendReason('');
                      }}
                      disabled={busy}
                      type="button"
                    >
                      {t('admin.users.disable')}
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && !error && activeTab === 'companies' ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="space-y-3">
            {companies.map((comp) => (
              <div
                key={comp.id || comp.name}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-4 text-sm"
              >
                <div>
                  <p className="font-semibold">{comp.name || comp.companyName}</p>
                  <p className="font-mono text-xs text-[var(--text-2)]">
                    MST: {comp.taxCode || 'N/A'} · Status: {comp.verificationStatus || 'unverified'}
                  </p>
                </div>
                {comp.id ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleVerifyCompany(comp.id!, 'verified')}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      {t('admin.users.verifyCompany')}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleVerifyCompany(comp.id!, 'rejected')}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700"
                    >
                      {t('admin.users.rejectCompany')}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {suspendTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold">{t('dialogs.userStatus.disableTitle')}</h3>
            <p className="text-xs text-[var(--text-2)]">
              {t('dialogs.userStatus.description', { email: suspendTarget.email })}
            </p>
            <textarea
              className="min-h-24 w-full rounded-lg border border-[var(--border)] p-3 text-sm"
              placeholder={t('admin.users.suspendReasonPlaceholder')}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs"
                onClick={() => setSuspendTarget(null)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={busy || !suspendReason.trim()}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                onClick={() => void handleSuspendSubmit()}
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed right-6 top-6 z-50 flex w-96 max-w-[calc(100vw-3rem)]">
          <div
            className={`flex w-full items-start gap-3 rounded-xl border p-4 shadow-xl ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
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
              <p className="text-xs opacity-90">{toast.message}</p>
            </div>
            <button onClick={() => setToast(null)} aria-label="Close notification">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
