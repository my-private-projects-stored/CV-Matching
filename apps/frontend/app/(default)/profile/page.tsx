'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchMyCandidateProfile,
  updateMyCandidateProfile,
  type CandidateProfilePayload,
} from '@/lib/api/candidate-profile';
import { useAuth } from '@/lib/context/auth-context';
import { useTranslations } from '@/lib/i18n';

type FormState = {
  headline: string;
  summary: string;
  phone: string;
  location: string;
  website: string;
  skillsText: string;
  portfolioLinksText: string;
};

function toFormState(profile?: Partial<CandidateProfilePayload>): FormState {
  return {
    headline: profile?.headline || '',
    summary: profile?.summary || '',
    phone: profile?.phone || '',
    location: profile?.location || '',
    website: profile?.website || '',
    skillsText: Array.isArray(profile?.skills) ? profile?.skills.join(', ') : '',
    portfolioLinksText: Array.isArray(profile?.portfolio_links)
      ? profile?.portfolio_links.join(', ')
      : '',
  };
}

function toList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ProfilePage() {
  const { t } = useTranslations();
  const { user } = useAuth();

  const [form, setForm] = useState<FormState>(() => toFormState());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isCandidate = useMemo(() => user?.role === 'candidate' || user?.role === 'admin', [user?.role]);

  useEffect(() => {
    let canceled = false;

    async function loadProfile() {
      if (!isCandidate) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetchMyCandidateProfile();
        if (!canceled) {
          setForm(toFormState(response.data?.profile));
        }
      } catch (err) {
        if (!canceled) {
          setError(err instanceof Error ? err.message : t('profile.loadFailed'));
        }
      } finally {
        if (!canceled) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      canceled = true;
    };
  }, [isCandidate, t]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await updateMyCandidateProfile({
        headline: form.headline,
        summary: form.summary,
        phone: form.phone,
        location: form.location,
        website: form.website,
        skills: toList(form.skillsText),
        portfolio_links: toList(form.portfolioLinksText),
      });
      setSuccess(t('profile.saveSuccess'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  if (!isCandidate) {
    return (
      <section className="min-h-screen bg-[#F0F0E8] p-6 md:p-10">
        <Card variant="outline" className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>{t('profile.notCandidateTitle')}</CardTitle>
            <CardDescription>{t('profile.notCandidateDescription')}</CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            <Link href="/dashboard" className="text-blue-700 underline font-mono text-xs uppercase">
              {t('nav.backToDashboard')}
            </Link>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-[#F0F0E8] p-6 md:p-10">
      <Card variant="outline" className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>{t('profile.title')}</CardTitle>
          <CardDescription>{t('profile.description')}</CardDescription>
        </CardHeader>

        <form className="space-y-4 px-6 pb-6" onSubmit={handleSubmit}>
          <Input
            value={form.headline}
            onChange={(event) => setForm((prev) => ({ ...prev, headline: event.target.value }))}
            placeholder={t('profile.headlinePlaceholder')}
          />

          <Textarea
            value={form.summary}
            onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
            placeholder={t('profile.summaryPlaceholder')}
            rows={5}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder={t('profile.phonePlaceholder')}
            />
            <Input
              value={form.location}
              onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
              placeholder={t('profile.locationPlaceholder')}
            />
          </div>

          <Input
            value={form.website}
            onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
            placeholder={t('profile.websitePlaceholder')}
          />

          <Input
            value={form.skillsText}
            onChange={(event) => setForm((prev) => ({ ...prev, skillsText: event.target.value }))}
            placeholder={t('profile.skillsPlaceholder')}
          />

          <Input
            value={form.portfolioLinksText}
            onChange={(event) => setForm((prev) => ({ ...prev, portfolioLinksText: event.target.value }))}
            placeholder={t('profile.portfolioLinksPlaceholder')}
          />

          {error ? (
            <p className="font-mono text-xs uppercase text-red-700 border border-red-700 bg-red-50 px-3 py-2">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="font-mono text-xs uppercase text-green-700 border border-green-700 bg-green-50 px-3 py-2">
              {success}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <Link href="/dashboard" className="text-blue-700 underline font-mono text-xs uppercase">
              {t('nav.backToDashboard')}
            </Link>
            <Button type="submit" disabled={isLoading || isSaving}>
              {isSaving ? t('common.saving') : t('profile.saveAction')}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
