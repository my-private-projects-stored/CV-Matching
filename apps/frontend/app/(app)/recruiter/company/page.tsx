'use client';

import { useEffect, useState } from 'react';
import { PageHeader, ErrorBanner, SkeletonRow } from '@/components/ui';
import { getPath, putOne } from '@/lib/api';

type CompanyProfile = {
  id?: string;
  name?: string;
  industry?: string;
  website?: string;
  description?: string;
};

export default function RecruiterCompanyPage() {
  const [profile, setProfile] = useState<CompanyProfile>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getPath<CompanyProfile>('config/company-profile').then((res) => {
      if (!active) return;
      if (res.error) {
        setError(res.error);
        setProfile({});
      } else {
        setError(null);
        setProfile(res.data ?? {});
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleSave() {
    const res = await putOne<CompanyProfile, CompanyProfile>('config', 'company-profile', profile);
    if (res.error) {
      setError(res.error);
    } else {
      setError(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Company Profile" subtitle="Manage company details." />
      {loading ? <SkeletonRow /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!loading ? (
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5">
          <input
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder="Company name"
            value={profile.name || ''}
            onChange={(event) => setProfile({ ...profile, name: event.target.value })}
          />
          <input
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder="Industry"
            value={profile.industry || ''}
            onChange={(event) => setProfile({ ...profile, industry: event.target.value })}
          />
          <input
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder="Website"
            value={profile.website || ''}
            onChange={(event) => setProfile({ ...profile, website: event.target.value })}
          />
          <textarea
            className="min-h-24 w-full rounded-lg border border-[var(--border)] p-3 text-sm"
            placeholder="Description"
            value={profile.description || ''}
            onChange={(event) => setProfile({ ...profile, description: event.target.value })}
          />
          <button
            className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white"
            onClick={handleSave}
          >
            Save
          </button>
        </section>
      ) : null}
    </div>
  );
}
