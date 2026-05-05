'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { forgotPassword } from '@/lib/api/auth';
import { useTranslations } from '@/lib/i18n';

export default function ForgotPasswordPage() {
  const { t } = useTranslations();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setResetToken(null);
    setSubmitting(true);

    try {
      const result = await forgotPassword(email.trim());
      setMessage(result.message || t('auth.forgotPasswordSuccess'));
      setResetToken(result.reset_token || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.forgotPasswordFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="min-h-screen flex items-center justify-center p-6 bg-[#F0F0E8]">
      <Card variant="outline" className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.forgotPasswordTitle')}</CardTitle>
          <CardDescription>{t('auth.forgotPasswordDescription')}</CardDescription>
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

          {error ? (
            <p className="font-mono text-xs uppercase text-red-700 border border-red-700 bg-red-50 px-3 py-2">
              {error}
            </p>
          ) : null}

          {message ? (
            <div className="space-y-2 border border-black/10 bg-white px-3 py-3">
              <p className="font-mono text-xs uppercase text-gray-700">{message}</p>
              {resetToken ? (
                <Link
                  href={`/reset-password?token=${encodeURIComponent(resetToken)}`}
                  className="text-blue-700 underline text-xs uppercase font-mono"
                >
                  {t('auth.resetPasswordAction')}
                </Link>
              ) : null}
            </div>
          ) : null}

          <Button type="submit" disabled={submitting || !email.trim()} className="w-full">
            {submitting ? t('common.loading') : t('auth.forgotPasswordAction')}
          </Button>
        </form>

        <p className="mt-4 font-mono text-xs uppercase text-gray-600">
          <Link href="/login" className="text-blue-700 underline">
            {t('auth.backToLogin')}
          </Link>
        </p>
      </Card>
    </section>
  );
}
