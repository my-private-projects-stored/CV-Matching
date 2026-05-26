'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { UiLanguageSwitcher } from '@/components/ui/UiLanguageSwitcher';
import { useAuth } from '@/lib/context/auth-context';
import { useTranslations } from '@/lib/i18n/translations';
import type { UserRole } from '@/lib/api/auth';

function dashboardPath(role: UserRole) {
  if (role === 'recruiter') return '/recruiter/dashboard';
  if (role === 'admin') return '/admin/config';
  return '/candidate/dashboard';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();
  const { t } = useTranslations();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await signIn({ email, password });
      router.replace(dashboardPath(user.role));
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : t('auth.signInError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="flex items-center justify-between text-xs text-[var(--text-3)]">
        <UiLanguageSwitcher className="rounded-full border border-[var(--border)] px-3 py-1 text-xs" />
        <a className="text-[var(--blue-700)]" href="/register">
          {t('auth.noAccount')}
        </a>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--blue-600)]">{t('auth.eyebrow')}</p>
        <h1 className="mt-2 font-display text-4xl">{t('auth.welcome')}</h1>
        <p className="mt-2 text-sm text-[var(--text-2)]">{t('auth.signInSubtitle')}</p>
      </div>
      <p className="rounded-lg bg-[var(--blue-50)] px-3 py-2 text-xs text-[var(--blue-700)]">
        {t('auth.roleDeterminedByAccount')}
      </p>
      <div className="space-y-3">
        <input
          className="w-full rounded-lg border border-[var(--border)] px-4 py-3 text-sm"
          placeholder={t('auth.email')}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          className="w-full rounded-lg border border-[var(--border)] px-4 py-3 text-sm"
          placeholder={t('auth.password')}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <div className="flex justify-end">
          <a className="text-xs text-[var(--blue-700)]" href="/forgot-password">
            {t('auth.forgotPassword')}
          </a>
        </div>
        {error ? (
          <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-[var(--danger)]">
            {error}
          </p>
        ) : null}
        <button
          className="w-full rounded-lg bg-[var(--blue-700)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          {loading ? t('auth.signingIn') : `${t('auth.signIn')} ->`}
        </button>
        <div className="text-center text-xs text-[var(--text-3)]">{t('auth.orContinue')}</div>
        <button
          type="button"
          disabled
          className="w-full rounded-lg border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-3)] disabled:opacity-60"
        >
          {t('auth.googleNotConfigured')}
        </button>
      </div>
      <div className="flex justify-center gap-4 text-xs text-[var(--text-3)]">
        <a href="#">{t('auth.terms')}</a>
        <a href="#">{t('auth.privacy')}</a>
      </div>
    </form>
  );
}
