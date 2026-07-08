'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, X } from 'lucide-react';
import { RoleToggle } from '@/components/ui/RoleToggle';
import { useAuth } from '@/lib/context/auth-context';
import { useTranslations } from '@/lib/i18n/translations';
import {
  getRememberedEmails,
  saveRememberedEmail,
  removeRememberedEmail,
} from '@/lib/utils/remembered-accounts';

function dashboardPath(role: string) {
  if (role === 'recruiter') return '/recruiter/dashboard';
  if (role === 'admin') return '/admin/config';
  return '/candidate/dashboard';
}

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
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [rememberedEmails, setRememberedEmails] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredEmails = email.trim()
    ? rememberedEmails.filter((savedEmail) =>
        savedEmail.toLowerCase().includes(email.trim().toLowerCase())
      )
    : rememberedEmails;

  const { signUp, isAuthenticated, user, isLoading } = useAuth();
  const router = useRouter();
  const { t } = useTranslations();

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Redirection when already logged in
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      router.replace(dashboardPath(user.role));
    }
  }, [isLoading, isAuthenticated, user, router]);

  // Load remembered accounts on mount
  useEffect(() => {
    setRememberedEmails(getRememberedEmails());
  }, []);

  // Handle clicks outside remembered email dropdown to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
      saveRememberedEmail(email);
      router.replace(role === 'recruiter' ? '/recruiter/dashboard' : '/candidate/dashboard');
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : t('auth.createAccountError'));
    } finally {
      setLoading(false);
    }
  }

  // Prevent flash of form content during loading or redirection check
  if (isLoading || isAuthenticated) {
    return (
      <div className="flex min-h-[250px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--blue-600)] border-t-transparent" />
      </div>
    );
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
        <div className="relative w-full" ref={dropdownRef}>
          <input
            className="w-full rounded-lg border border-[var(--border)] px-4 py-3 text-sm"
            placeholder={t('auth.email')}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onFocus={() => setShowDropdown(true)}
            required
          />
          {showDropdown && filteredEmails.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg">
              {filteredEmails.map((savedEmail) => (
                <li
                  key={savedEmail}
                  className="flex items-center justify-between px-4 py-2 hover:bg-[var(--blue-50)] cursor-pointer text-sm"
                  onClick={() => {
                    setEmail(savedEmail);
                    setShowDropdown(false);
                    passwordInputRef.current?.focus();
                  }}
                >
                  <div className="flex items-center gap-2 text-[var(--text-1)]">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--blue-100)] text-[10px] font-semibold text-[var(--blue-700)]">
                      {savedEmail.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="truncate">{savedEmail}</span>
                  </div>
                  <button
                    type="button"
                    className="rounded-full p-1 text-[var(--text-3)] hover:bg-red-50 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const updated = removeRememberedEmail(savedEmail);
                      setRememberedEmails(updated);
                    }}
                    aria-label="Remove email"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="relative w-full">
          <input
            ref={passwordInputRef}
            className="w-full rounded-lg border border-[var(--border)] pl-4 pr-10 py-3 text-sm"
            placeholder={t('auth.password')}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text-1)]"
            onClick={() => setShowPassword((prev) => !prev)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <div className="relative w-full">
          <input
            className="w-full rounded-lg border border-[var(--border)] pl-4 pr-10 py-3 text-sm"
            placeholder={t('auth.confirmPassword')}
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            required
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text-1)]"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            tabIndex={-1}
          >
            {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
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

