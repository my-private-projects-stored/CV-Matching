'use client';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

import { useEffect, useState } from 'react';
import { PageHeader, ErrorBanner, SkeletonCard } from '@/components/ui';
import { getPath, putOne } from '@/lib/api';
import type { User } from '@/types';

type CandidateProfileResponse = {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  profile: {
    headline?: string;
    summary?: string;
    phone?: string;
    location?: string;
    website?: string;
  };
};

type ProfileForm = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  summary: string;
  website: string;
};

export default function CandidateProfilePage() {
  const header = usePageHeader('candidateProfile');
  const { t } = useTranslations();
  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    headline: '',
    summary: '',
    website: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getPath<User>('users/me'),
      getPath<CandidateProfileResponse>('candidate-profile/me'),
    ]).then(([userRes, profileRes]) => {
      if (!active) return;
      if (userRes.error || profileRes.error) {
        setError(userRes.error || profileRes.error || t('errors.loadProfile'));
        setUser(null);
      } else {
        const profile = profileRes.data?.profile ?? {};
        const loadedUser = userRes.data ?? null;
        setError(null);
        setUser(loadedUser);
        setForm({
          fullName: loadedUser?.fullName || profileRes.data?.full_name || '',
          email: loadedUser?.email || profileRes.data?.email || '',
          phone: profile.phone || '',
          location: profile.location || '',
          headline: profile.headline || '',
          summary: profile.summary || '',
          website: profile.website || '',
        });
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [t]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);

    const res = await putOne<CandidateProfileResponse, Record<string, unknown>>(
      'candidate-profile',
      'me',
      {
        phone: form.phone,
        location: form.location,
        headline: form.headline,
        summary: form.summary,
        website: form.website,
      }
    );

    if (res.error) {
      setError(res.error);
    } else {
      setMessage(t('settings.profileSaved'));
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={header.title} subtitle={header.subtitle} />
      {loading ? <SkeletonCard /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {message ? (
        <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-[var(--success)]">
          {message}
        </p>
      ) : null}
      {!loading && user ? (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <div className="h-24 w-24 rounded-full bg-[var(--blue-100)]" />
            <p className="mt-3 text-sm font-semibold">{form.fullName}</p>
            <p className="text-xs text-[var(--text-3)]">{t(`roles.${user.role}`)}</p>
          </aside>
          <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                value={form.fullName}
                readOnly
              />
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                value={form.email}
                readOnly
              />
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                placeholder={t('forms.phone')}
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                placeholder={t('forms.location')}
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
              />
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm md:col-span-2"
                placeholder={t('forms.headline')}
                value={form.headline}
                onChange={(event) => setForm({ ...form, headline: event.target.value })}
              />
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm md:col-span-2"
                placeholder={t('forms.portfolioUrl')}
                value={form.website}
                onChange={(event) => setForm({ ...form, website: event.target.value })}
              />
            </div>
            <div className="mt-4">
              <textarea
                className="min-h-24 w-full rounded-lg border border-[var(--border)] p-3 text-sm"
                placeholder={t('forms.summary')}
                value={form.summary}
                onChange={(event) => setForm({ ...form, summary: event.target.value })}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? t('forms.saving') : t('forms.saveChanges')}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
