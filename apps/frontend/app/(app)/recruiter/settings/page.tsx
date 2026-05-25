'use client';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

import { useState, type FormEvent } from 'react';
import { PageHeader, ErrorBanner } from '@/components/ui';
import { changePassword } from '@/lib/api/auth';
import { useAuth } from '@/lib/context/auth-context';

export default function RecruiterSettingsPage() {
  const header = usePageHeader('recruiterSettings');
  const { t } = useTranslations();
  const { accessToken, signOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setError(t('errors.passwordMismatch'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('errors.passwordMinLength'));
      return;
    }
    if (!accessToken) {
      setError(t('errors.notAuthenticated'));
      return;
    }

    setLoading(true);
    try {
      await changePassword(accessToken, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setMessage(t('settings.passwordChangedSuccess'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => signOut(), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.changePassword'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={header.title} subtitle={header.subtitle} />
      <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
        <h2 className="text-sm font-semibold">{t('settings.changePassword')}</h2>
        <p className="mt-1 text-xs text-[var(--text-2)]">
          {t('settings.signOutAfterPasswordChange')}
        </p>
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-lg border border-[var(--border)] px-4 py-3 text-sm"
            placeholder={t('forms.currentPassword')}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-[var(--border)] px-4 py-3 text-sm"
            placeholder={t('forms.newPasswordMin')}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
          <input
            className="w-full rounded-lg border border-[var(--border)] px-4 py-3 text-sm"
            placeholder={t('forms.confirmNewPassword')}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
          {error ? <ErrorBanner message={error} /> : null}
          {message ? (
            <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-[var(--success)]">
              {message}
            </p>
          ) : null}
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-[var(--blue-700)] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              disabled={loading}
            >
              {loading ? t('forms.saving') : t('settings.changePassword')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
