'use client';

import { useState, type FormEvent } from 'react';
import { forgotPassword } from '@/lib/api/auth';
import { useTranslations } from '@/lib/i18n/translations';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslations();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const result = await forgotPassword(email);
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <h1 className="font-display text-4xl">{t('auth.resetPassword')}</h1>
      <p className="text-sm text-[var(--text-2)]">{t('auth.resetEmailHint')}</p>
      <input
        className="w-full rounded-lg border border-[var(--border)] px-4 py-3 text-sm"
        placeholder={t('auth.email')}
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      {message ? (
        <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-[var(--success)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <button
        className="w-full rounded-lg bg-[var(--blue-700)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading}
      >
        {loading ? t('auth.sending') : t('auth.sendReset')}
      </button>
      <a className="text-xs text-[var(--blue-700)]" href="/login">
        {t('auth.backToSignIn')}
      </a>
    </form>
  );
}
