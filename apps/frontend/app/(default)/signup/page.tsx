'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTranslations } from '@/lib/i18n';
import { useAuth } from '@/lib/context/auth-context';
import type { UserRole } from '@/lib/api/auth';

export default function SignupPage() {
  const { t } = useTranslations();
  const router = useRouter();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('candidate');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await signUp({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
      });
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.signupFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="min-h-screen flex items-center justify-center p-6 bg-[#F0F0E8]">
      <Card variant="outline" className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.signupTitle')}</CardTitle>
          <CardDescription>{t('auth.signupDescription')}</CardDescription>
        </CardHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t('auth.fullNamePlaceholder')}
            autoComplete="name"
            required
          />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.emailPlaceholder')}
            autoComplete="email"
            required
          />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.passwordPlaceholder')}
            autoComplete="new-password"
            required
          />

          <select
            className="h-10 w-full border border-black bg-white px-3 text-sm uppercase"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            <option value="candidate">{t('auth.roleCandidate')}</option>
            <option value="recruiter">{t('auth.roleRecruiter')}</option>
          </select>

          {error ? (
            <p className="font-mono text-xs uppercase text-red-700 border border-red-700 bg-red-50 px-3 py-2">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={submitting || !email.trim() || !password || !fullName.trim()}
            className="w-full"
          >
            {submitting ? t('common.loading') : t('auth.signupAction')}
          </Button>
        </form>

        <p className="mt-4 font-mono text-xs uppercase text-gray-600">
          {t('auth.hasAccountPrompt')}{' '}
          <Link href="/login" className="text-blue-700 underline">
            {t('auth.loginAction')}
          </Link>
        </p>
      </Card>
    </section>
  );
}
