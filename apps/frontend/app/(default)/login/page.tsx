'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTranslations } from '@/lib/i18n';
import { useAuth } from '@/lib/context/auth-context';

export default function LoginPage() {
  const { t } = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    const next = searchParams.get('next');
    if (!next || !next.startsWith('/')) {
      return '/dashboard';
    }
    return next;
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await signIn({ email: email.trim(), password });
      router.replace(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="min-h-screen flex items-center justify-center p-6 bg-[#F0F0E8]">
      <Card variant="outline" className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.loginTitle')}</CardTitle>
          <CardDescription>{t('auth.loginDescription')}</CardDescription>
        </CardHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
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
            autoComplete="current-password"
            required
          />

          {error ? (
            <p className="font-mono text-xs uppercase text-red-700 border border-red-700 bg-red-50 px-3 py-2">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting || !email.trim() || !password} className="w-full">
            {submitting ? t('common.loading') : t('auth.loginAction')}
          </Button>
        </form>

        <p className="mt-4 font-mono text-xs uppercase text-gray-600">
          {t('auth.noAccountPrompt')}{' '}
          <Link href="/signup" className="text-blue-700 underline">
            {t('auth.signupAction')}
          </Link>
        </p>
        <p className="mt-2 font-mono text-xs uppercase text-gray-600">
          <Link href="/forgot-password" className="text-blue-700 underline">
            {t('auth.forgotPasswordAction')}
          </Link>
        </p>
      </Card>
    </section>
  );
}
