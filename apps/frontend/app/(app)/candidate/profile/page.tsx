'use client';

import { useEffect, useState } from 'react';
import { PageHeader, ErrorBanner, SkeletonCard } from '@/components/ui';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';
import {
  fetchMyCandidateProfile,
  updateMyCandidateProfile,
  type CandidatePortfolioItem,
  type CandidateProfileEducation,
  type CandidateProfileExperience,
  type CandidateProfilePayload,
} from '@/lib/api/candidate-profile';

type ProfileForm = CandidateProfilePayload & {
  full_name: string;
  email: string;
  skills_text: string;
  portfolio_links_text: string;
  experience_json: string;
  education_json: string;
  portfolio_json: string;
};

const EMPTY_PROFILE: ProfileForm = {
  full_name: '',
  email: '',
  headline: '',
  summary: '',
  phone: '',
  location: '',
  website: '',
  portfolio_links: [],
  skills: [],
  experience: [],
  education: [],
  portfolio: [],
  skills_text: '',
  portfolio_links_text: '',
  experience_json: '[]',
  education_json: '[]',
  portfolio_json: '[]',
};

function linesToArray(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? [], null, 2);
}

function parseJsonArray<T>(value: string, fallback: T[]): T[] {
  const parsed = JSON.parse(value || '[]');
  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array.');
  }
  return parsed as T[];
}

function TextField({
  label,
  value,
  onChange,
  readOnly,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  type?: string;
}) {
  return (
    <label className="space-y-1 text-xs font-semibold text-[var(--text-3)]">
      <span>{label}</span>
      <input
        className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-normal text-[var(--text-1)] disabled:bg-slate-50"
        value={value}
        type={type}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </label>
  );
}

export default function CandidateProfilePage() {
  const header = usePageHeader('candidateProfile');
  const { t } = useTranslations();
  const [form, setForm] = useState<ProfileForm>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchMyCandidateProfile()
      .then((payload) => {
        if (!active) return;
        const profile = payload.data.profile ?? EMPTY_PROFILE;
        setForm({
          ...EMPTY_PROFILE,
          ...profile,
          full_name: payload.data.full_name,
          email: payload.data.email,
          skills_text: (profile.skills ?? []).join('\n'),
          portfolio_links_text: (profile.portfolio_links ?? []).join('\n'),
          experience_json: formatJson(profile.experience),
          education_json: formatJson(profile.education),
          portfolio_json: formatJson(profile.portfolio),
        });
        setError(null);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : t('errors.loadProfile'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload: Partial<CandidateProfilePayload> = {
        headline: form.headline,
        summary: form.summary,
        phone: form.phone,
        location: form.location,
        website: form.website,
        skills: linesToArray(form.skills_text),
        portfolio_links: linesToArray(form.portfolio_links_text),
        experience: parseJsonArray<CandidateProfileExperience>(form.experience_json, []),
        education: parseJsonArray<CandidateProfileEducation>(form.education_json, []),
        portfolio: parseJsonArray<CandidatePortfolioItem>(form.portfolio_json, []),
      };
      const saved = await updateMyCandidateProfile(payload);
      const profile = saved.data.profile;
      setForm((current) => ({
        ...current,
        ...profile,
        skills_text: (profile.skills ?? []).join('\n'),
        portfolio_links_text: (profile.portfolio_links ?? []).join('\n'),
        experience_json: formatJson(profile.experience),
        education_json: formatJson(profile.education),
        portfolio_json: formatJson(profile.portfolio),
      }));
      setMessage(t('settings.profileSaved'));
    } catch (requestError) {
      const message =
        requestError instanceof Error && requestError.message === 'Expected a JSON array.'
          ? t('errors.invalidJsonArray')
          : requestError instanceof Error
            ? requestError.message
            : t('errors.saveFailed');
      setError(message);
    } finally {
      setSaving(false);
    }
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
      {!loading ? (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--blue-100)] text-2xl font-semibold text-[var(--blue-700)]">
              {(form.full_name || form.email || '?').slice(0, 1).toUpperCase()}
            </div>
            <p className="mt-3 text-sm font-semibold">{form.full_name || form.email}</p>
            <p className="text-xs text-[var(--text-3)]">{form.headline || t('forms.headline')}</p>
          </aside>
          <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <TextField label={t('auth.fullName')} value={form.full_name} readOnly />
              <TextField label={t('auth.email')} value={form.email} readOnly type="email" />
              <TextField
                label={t('forms.phone')}
                value={form.phone}
                onChange={(value) => update('phone', value)}
              />
              <TextField
                label={t('forms.location')}
                value={form.location}
                onChange={(value) => update('location', value)}
              />
              <TextField
                label={t('forms.headline')}
                value={form.headline}
                onChange={(value) => update('headline', value)}
              />
              <TextField
                label={t('forms.website')}
                value={form.website}
                onChange={(value) => update('website', value)}
                type="url"
              />
            </div>
            <label className="mt-4 block space-y-1 text-xs font-semibold text-[var(--text-3)]">
              <span>{t('forms.summary')}</span>
              <textarea
                className="min-h-28 w-full rounded-lg border border-[var(--border)] p-3 text-sm font-normal text-[var(--text-1)]"
                value={form.summary}
                onChange={(event) => update('summary', event.target.value)}
              />
            </label>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold text-[var(--text-3)]">
                <span>{t('forms.skills')}</span>
                <textarea
                  className="min-h-28 w-full rounded-lg border border-[var(--border)] p-3 text-sm font-normal text-[var(--text-1)]"
                  value={form.skills_text}
                  onChange={(event) => update('skills_text', event.target.value)}
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-[var(--text-3)]">
                <span>{t('forms.portfolioLinks')}</span>
                <textarea
                  className="min-h-28 w-full rounded-lg border border-[var(--border)] p-3 text-sm font-normal text-[var(--text-1)]"
                  value={form.portfolio_links_text}
                  onChange={(event) => update('portfolio_links_text', event.target.value)}
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-[var(--text-3)]">
                <span>{t('forms.experienceJson')}</span>
                <textarea
                  className="min-h-48 w-full rounded-lg border border-[var(--border)] p-3 font-mono text-xs font-normal text-[var(--text-1)]"
                  value={form.experience_json}
                  onChange={(event) => update('experience_json', event.target.value)}
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-[var(--text-3)]">
                <span>{t('forms.educationJson')}</span>
                <textarea
                  className="min-h-48 w-full rounded-lg border border-[var(--border)] p-3 font-mono text-xs font-normal text-[var(--text-1)]"
                  value={form.education_json}
                  onChange={(event) => update('education_json', event.target.value)}
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-[var(--text-3)] lg:col-span-2">
                <span>{t('forms.portfolioJson')}</span>
                <textarea
                  className="min-h-36 w-full rounded-lg border border-[var(--border)] p-3 font-mono text-xs font-normal text-[var(--text-1)]"
                  value={form.portfolio_json}
                  onChange={(event) => update('portfolio_json', event.target.value)}
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={() => void handleSave()}
                disabled={saving}
                type="button"
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
