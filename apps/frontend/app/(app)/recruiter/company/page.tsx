'use client';

import { useEffect, useState } from 'react';
import { PageHeader, ErrorBanner, SkeletonRow } from '@/components/ui';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';
import { fetchMyCompany, updateMyCompany, type CompanyProfile } from '@/lib/api/company';

export default function RecruiterCompanyPage() {
  const header = usePageHeader('recruiterCompany');
  const { t } = useTranslations();
  const [profile, setProfile] = useState<CompanyProfile>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchMyCompany()
      .then((payload) => {
        if (!active) return;
        setProfile(payload);
        setError(null);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError instanceof Error ? requestError.message : t('errors.loadCompanyProfile')
        );
        setProfile({});
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await updateMyCompany(profile);
      setProfile(saved);
      setMessage(t('recruiter.company.saved'));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.saveCompany'));
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <PageHeader title={header.title} subtitle={header.subtitle} />
      {loading ? <SkeletonRow /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {message ? (
        <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-[var(--success)]">
          {message}
        </p>
      ) : null}
      {!loading ? (
        <section className="grid gap-4 rounded-2xl border border-[var(--border)] bg-white p-5 md:grid-cols-2">
          <input
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder={t('forms.companyName')}
            value={profile.name || profile.companyName || ''}
            onChange={(event) => update('name', event.target.value)}
          />
          <input
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder={t('forms.industry')}
            value={profile.industry || ''}
            onChange={(event) => update('industry', event.target.value)}
          />
          <input
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder={t('forms.website')}
            value={profile.website || ''}
            onChange={(event) => update('website', event.target.value)}
          />
          <input
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder={t('forms.companySize')}
            value={profile.companySize || ''}
            onChange={(event) => update('companySize', event.target.value)}
          />
          <input
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm md:col-span-2"
            placeholder={t('forms.address')}
            value={profile.address || ''}
            onChange={(event) => update('address', event.target.value)}
          />
          <textarea
            className="min-h-28 rounded-lg border border-[var(--border)] p-3 text-sm md:col-span-2"
            placeholder={t('forms.description')}
            value={profile.description || profile.overview || ''}
            onChange={(event) => update('description', event.target.value)}
          />
          <input
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder={t('forms.brandPrimaryColor')}
            value={profile.brandPrimaryColor || ''}
            onChange={(event) => update('brandPrimaryColor', event.target.value)}
          />
          <input
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder={t('forms.brandLogoUrl')}
            value={profile.brandLogoUrl || ''}
            onChange={(event) => update('brandLogoUrl', event.target.value)}
          />
          <div className="md:col-span-2 flex justify-end">
            <button
              className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white disabled:opacity-60"
              onClick={() => void handleSave()}
              disabled={saving}
              type="button"
            >
              {saving ? t('forms.saving') : t('common.save')}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
