'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { resetPassword } from '@/lib/api/auth';
import { useTranslations } from '@/lib/i18n';

export default function ResetPasswordPage() {
  const { t } = useTranslations();
  const searchParams = useSearchParams();

  const initialToken = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError(t('auth.resetTokenRequired'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setSubmitting(true);

    try {
      const result = await resetPassword({ token: trimmedToken, new_password: newPassword });
      setMessage(result.message || t('auth.resetPasswordSuccess'));
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.resetPasswordFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="min-h-screen flex items-center justify-center p-6 bg-[#F0F0E8]">
      <Card variant="outline" className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.resetPasswordTitle')}</CardTitle>
          <CardDescription>{t('auth.resetPasswordDescription')}</CardDescription>
        </CardHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t('auth.resetTokenPlaceholder')}
            autoComplete="one-time-code"
            required
          />
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t('auth.newPasswordPlaceholder')}
            autoComplete="new-password"
            required
          />
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t('auth.confirmPasswordPlaceholder')}
            autoComplete="new-password"
            required
          />

          {error ? (
            <p className="font-mono text-xs uppercase text-red-700 border border-red-700 bg-red-50 px-3 py-2">
              {error}
            </p>
          ) : null}

          {message ? (
            <p className="font-mono text-xs uppercase text-green-700 border border-green-700 bg-green-50 px-3 py-2">
              {message}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={submitting || !token.trim() || !newPassword || !confirmPassword}
            className="w-full"
          >
            {submitting ? t('common.loading') : t('auth.resetPasswordAction')}
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
