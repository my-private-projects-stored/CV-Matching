'use client';

import { Suspense } from 'react';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { resetPassword } from '@/lib/api/auth';
import { useTranslations } from '@/lib/i18n/translations';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { t } = useTranslations();

  if (!token) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl">{t('auth.invalidLink')}</h1>
        <p className="text-sm text-[var(--text-2)]">{t('auth.invalidLinkHint')}</p>
        <a className="text-sm text-[var(--blue-700)]" href="/forgot-password">
          {t('auth.requestNewLink')}
        </a>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl">{t('auth.resetPassword')}</h1>
        <p className="rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800">
          {t('auth.passwordResetSuccess')}
        </p>
        <a className="block text-sm text-[var(--blue-700)]" href="/login">
          {t('auth.signInWithNewPassword')}
        </a>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('auth.passwordMinLength'));
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ token, new_password: newPassword });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.resetFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--blue-600)]">{t('auth.accountEyebrow')}</p>
        <h1 className="mt-2 font-display text-4xl">{t('auth.setNewPassword')}</h1>
        <p className="mt-2 text-sm text-[var(--text-2)]">{t('auth.setNewPasswordHint')}</p>
      </div>
      <div className="space-y-3">
        <input
          className="w-full rounded-lg border border-[var(--border)] px-4 py-3 text-sm"
          placeholder={t('auth.newPassword')}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={8}
          required
        />
        <input
          className="w-full rounded-lg border border-[var(--border)] px-4 py-3 text-sm"
          placeholder={t('auth.confirmPassword')}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
          required
        />
        {error ? (
          <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-[var(--danger)]">
            {error}
          </p>
        ) : null}
        <button
          className="w-full rounded-lg bg-[var(--blue-700)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={loading}
        >
          {loading ? t('auth.resetting') : t('auth.resetSubmit')}
        </button>
      </div>
      <div className="text-xs text-[var(--text-3)]">
        <a className="text-[var(--blue-700)]" href="/login">
          ← {t('auth.backToSignIn')}
        </a>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { t } = useTranslations();

  return (
    <Suspense fallback={<ResetFormLoading message={t('auth.resetFormLoading')} />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetFormLoading({ message }: { message: string }) {
  return <div className="text-sm text-[var(--text-2)]">{message}</div>;
}
