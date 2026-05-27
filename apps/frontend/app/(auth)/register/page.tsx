'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { RoleToggle } from '@/components/ui/RoleToggle';
import { useAuth } from '@/lib/context/auth-context';
import { useTranslations } from '@/lib/i18n/translations';

export default function RegisterPage() {
  const [role, setRole] = useState<'candidate' | 'recruiter'>('candidate');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();
  const { t } = useTranslations();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    if (!acceptedTerms) {
      setError(t('auth.acceptTermsRequired'));
      return;
    }

    setLoading(true);
    try {
      await signUp({
        email,
        password,
        full_name:
          role === 'recruiter' && companyName.trim()
            ? `${fullName.trim()} (${companyName.trim()})`
            : fullName,
        role,
      });
      router.replace(role === 'recruiter' ? '/recruiter/dashboard' : '/candidate/dashboard');
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : t('auth.createAccountError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--blue-600)]">
          {t('auth.eyebrow')}
        </p>
        <h1 className="mt-2 font-display text-4xl">{t('auth.registerTitle')}</h1>
        <p className="mt-2 text-sm text-[var(--text-2)]">{t('auth.getStarted')}</p>
      </div>
      <RoleToggle value={role} onChange={setRole} />
      <div className="space-y-3">
        <input
          className="w-full rounded-lg border border-[var(--border)] px-4 py-3 text-sm"
          placeholder={t('auth.fullName')}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
        {role === 'recruiter' ? (
          <input
            className="w-full rounded-lg border border-[var(--border)] px-4 py-3 text-sm"
            placeholder={t('auth.companyName')}
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
          />
        ) : null}
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
          minLength={8}
          required
        />
        <input
          className="w-full rounded-lg border border-[var(--border)] px-4 py-3 text-sm"
          placeholder={t('auth.confirmPassword')}
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          minLength={8}
          required
        />
        <label className="flex items-center gap-2 text-xs text-[var(--text-2)]">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
          />
          {t('auth.termsAgree')}
        </label>
        {error ? (
          <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-[var(--danger)]">
            {error}
          </p>
        ) : null}
        <button
          className="w-full rounded-lg bg-[var(--blue-700)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          {loading ? t('auth.creating') : `${t('auth.createAccount')} ->`}
        </button>
      </div>
      <div className="text-xs text-[var(--text-3)]">
        {t('auth.hasAccount')}{' '}
        <a className="text-[var(--blue-700)]" href="/login">
          {t('auth.signIn')}
        </a>
      </div>
    </form>
  );
}
