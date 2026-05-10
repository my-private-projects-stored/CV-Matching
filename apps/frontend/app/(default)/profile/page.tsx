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
  experience: CandidateProfilePayload['experience'];
  education: CandidateProfilePayload['education'];
  portfolio: CandidateProfilePayload['portfolio'];
};

type ExperienceItem = CandidateProfilePayload['experience'][number];
type EducationItem = CandidateProfilePayload['education'][number];
type PortfolioItem = CandidateProfilePayload['portfolio'][number];

const EMPTY_EXPERIENCE: ExperienceItem = {
  title: '',
  company: '',
  location: '',
  start_date: '',
  end_date: '',
  summary: '',
};

const EMPTY_EDUCATION: EducationItem = {
  school: '',
  degree: '',
  field: '',
  start_date: '',
  end_date: '',
  summary: '',
};

const EMPTY_PORTFOLIO: PortfolioItem = {
  name: '',
  url: '',
  description: '',
};

function toExperienceItem(item?: Partial<ExperienceItem>): ExperienceItem {
  return {
    title: item?.title || '',
    company: item?.company || '',
    location: item?.location || '',
    start_date: item?.start_date || '',
    end_date: item?.end_date || '',
    summary: item?.summary || '',
  };
}

function toEducationItem(item?: Partial<EducationItem>): EducationItem {
  return {
    school: item?.school || '',
    degree: item?.degree || '',
    field: item?.field || '',
    start_date: item?.start_date || '',
    end_date: item?.end_date || '',
    summary: item?.summary || '',
  };
}

function toPortfolioItem(item?: Partial<PortfolioItem>): PortfolioItem {
  return {
    name: item?.name || '',
    url: item?.url || '',
    description: item?.description || '',
  };
}

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
    experience: Array.isArray(profile?.experience)
      ? profile?.experience.map((item) => toExperienceItem(item))
      : [],
    education: Array.isArray(profile?.education)
      ? profile?.education.map((item) => toEducationItem(item))
      : [],
    portfolio: Array.isArray(profile?.portfolio)
      ? profile?.portfolio.map((item) => toPortfolioItem(item))
      : [],
  };
}

function toList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isExperienceEmpty(item: ExperienceItem): boolean {
  return Object.values(item).every((value) => !String(value || '').trim());
}

function isEducationEmpty(item: EducationItem): boolean {
  return Object.values(item).every((value) => !String(value || '').trim());
}

function isPortfolioEmpty(item: PortfolioItem): boolean {
  return Object.values(item).every((value) => !String(value || '').trim());
}

export default function ProfilePage() {
  const { t } = useTranslations();
  const { user } = useAuth();

  const [form, setForm] = useState<FormState>(() => toFormState());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ headline?: string; summary?: string }>({});

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
    setFieldErrors({});
    setSuccess(null);
    setIsSaving(true);

    const experience = form.experience.filter((item) => !isExperienceEmpty(item));
    const education = form.education.filter((item) => !isEducationEmpty(item));
    const portfolio = form.portfolio.filter((item) => !isPortfolioEmpty(item));

    // Client-side validation: headline required, summary minimum length
    if (!String(form.headline || '').trim()) {
      setFieldErrors({ headline: t('profile.errors.headlineRequired') });
      setIsSaving(false);
      return;
    }

    if (String(form.summary || '').trim().length > 0 && String(form.summary || '').trim().length < 20) {
      setFieldErrors({ summary: t('profile.errors.summaryTooShort') });
      setIsSaving(false);
      return;
    }

    try {
      await updateMyCandidateProfile({
        headline: form.headline,
        summary: form.summary,
        phone: form.phone,
        location: form.location,
        website: form.website,
        skills: toList(form.skillsText),
        portfolio_links: toList(form.portfolioLinksText),
        experience,
        education,
        portfolio,
      });
      setSuccess(t('profile.saveSuccess'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  function addExperience() {
    setForm((prev) => ({ ...prev, experience: [...prev.experience, { ...EMPTY_EXPERIENCE }] }));
  }

  function updateExperience(index: number, patch: Partial<ExperienceItem>) {
    setForm((prev) => ({
      ...prev,
      experience: prev.experience.map((item, current) =>
        current === index ? { ...item, ...patch } : item
      ),
    }));
  }

  function removeExperience(index: number) {
    setForm((prev) => ({
      ...prev,
      experience: prev.experience.filter((_, current) => current !== index),
    }));
  }

  function addEducation() {
    setForm((prev) => ({ ...prev, education: [...prev.education, { ...EMPTY_EDUCATION }] }));
  }

  function updateEducation(index: number, patch: Partial<EducationItem>) {
    setForm((prev) => ({
      ...prev,
      education: prev.education.map((item, current) =>
        current === index ? { ...item, ...patch } : item
      ),
    }));
  }

  function removeEducation(index: number) {
    setForm((prev) => ({
      ...prev,
      education: prev.education.filter((_, current) => current !== index),
    }));
  }

  function addPortfolio() {
    setForm((prev) => ({ ...prev, portfolio: [...prev.portfolio, { ...EMPTY_PORTFOLIO }] }));
  }

  function updatePortfolio(index: number, patch: Partial<PortfolioItem>) {
    setForm((prev) => ({
      ...prev,
      portfolio: prev.portfolio.map((item, current) =>
        current === index ? { ...item, ...patch } : item
      ),
    }));
  }

  function removePortfolio(index: number) {
    setForm((prev) => ({
      ...prev,
      portfolio: prev.portfolio.filter((_, current) => current !== index),
    }));
  }

  if (!isCandidate) {
    return (
      <section className="space-y-8">
        <Card variant="outline" className="mx-auto max-w-2xl bg-white">
          <CardHeader>
            <CardTitle>{t('profile.notCandidateTitle')}</CardTitle>
            <CardDescription>{t('profile.notCandidateDescription')}</CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            <Link
              href="/dashboard"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--primary)] underline"
            >
              {t('nav.backToDashboard')}
            </Link>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="rounded-3xl border border-[color:var(--border)] bg-white px-6 py-5 shadow-[0_18px_34px_rgba(15,27,45,0.12)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--text-subtle)]">
            Hồ sơ ứng viên
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)] md:text-4xl">
            {t('profile.title')}
          </h1>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            {t('profile.description')}
          </p>
        </div>

        <Card variant="outline" className="bg-white">
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
          {fieldErrors.headline ? (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
              {fieldErrors.headline}
            </p>
          ) : null}

          <Textarea
            value={form.summary}
            onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
            placeholder={t('profile.summaryPlaceholder')}
            rows={5}
          />
          {fieldErrors.summary ? (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
              {fieldErrors.summary}
            </p>
          ) : null}

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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                {t('profile.experienceTitle')}
              </p>
              <Button type="button" variant="outline" onClick={addExperience}>
                {t('profile.addExperienceAction')}
              </Button>
            </div>
            {form.experience.length ? (
              form.experience.map((item, index) => (
                <div
                  key={`experience-${index}`}
                  className="space-y-2 rounded-2xl border border-[color:var(--border)] bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                      {t('profile.experienceItemLabel', { index: index + 1 })}
                    </p>
                    <Button type="button" variant="outline" onClick={() => removeExperience(index)}>
                      {t('profile.removeItemAction')}
                    </Button>
                  </div>
                  <Input
                    value={item.title}
                    onChange={(event) => updateExperience(index, { title: event.target.value })}
                    placeholder={t('profile.experienceTitlePlaceholder')}
                  />
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Input
                      value={item.company}
                      onChange={(event) => updateExperience(index, { company: event.target.value })}
                      placeholder={t('profile.experienceCompanyPlaceholder')}
                    />
                    <Input
                      value={item.location}
                      onChange={(event) => updateExperience(index, { location: event.target.value })}
                      placeholder={t('profile.experienceLocationPlaceholder')}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Input
                      value={item.start_date}
                      onChange={(event) => updateExperience(index, { start_date: event.target.value })}
                      placeholder={t('profile.experienceStartDatePlaceholder')}
                    />
                    <Input
                      value={item.end_date}
                      onChange={(event) => updateExperience(index, { end_date: event.target.value })}
                      placeholder={t('profile.experienceEndDatePlaceholder')}
                    />
                  </div>
                  <Textarea
                    value={item.summary}
                    onChange={(event) => updateExperience(index, { summary: event.target.value })}
                    placeholder={t('profile.experienceSummaryPlaceholder')}
                    rows={3}
                  />
                </div>
              ))
            ) : (
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                {t('profile.experienceEmpty')}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                {t('profile.educationTitle')}
              </p>
              <Button type="button" variant="outline" onClick={addEducation}>
                {t('profile.addEducationAction')}
              </Button>
            </div>
            {form.education.length ? (
              form.education.map((item, index) => (
                <div
                  key={`education-${index}`}
                  className="space-y-2 rounded-2xl border border-[color:var(--border)] bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                      {t('profile.educationItemLabel', { index: index + 1 })}
                    </p>
                    <Button type="button" variant="outline" onClick={() => removeEducation(index)}>
                      {t('profile.removeItemAction')}
                    </Button>
                  </div>
                  <Input
                    value={item.school}
                    onChange={(event) => updateEducation(index, { school: event.target.value })}
                    placeholder={t('profile.educationSchoolPlaceholder')}
                  />
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Input
                      value={item.degree}
                      onChange={(event) => updateEducation(index, { degree: event.target.value })}
                      placeholder={t('profile.educationDegreePlaceholder')}
                    />
                    <Input
                      value={item.field}
                      onChange={(event) => updateEducation(index, { field: event.target.value })}
                      placeholder={t('profile.educationFieldPlaceholder')}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Input
                      value={item.start_date}
                      onChange={(event) => updateEducation(index, { start_date: event.target.value })}
                      placeholder={t('profile.educationStartDatePlaceholder')}
                    />
                    <Input
                      value={item.end_date}
                      onChange={(event) => updateEducation(index, { end_date: event.target.value })}
                      placeholder={t('profile.educationEndDatePlaceholder')}
                    />
                  </div>
                  <Textarea
                    value={item.summary}
                    onChange={(event) => updateEducation(index, { summary: event.target.value })}
                    placeholder={t('profile.educationSummaryPlaceholder')}
                    rows={3}
                  />
                </div>
              ))
            ) : (
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                {t('profile.educationEmpty')}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                {t('profile.portfolioTitle')}
              </p>
              <Button type="button" variant="outline" onClick={addPortfolio}>
                {t('profile.addPortfolioAction')}
              </Button>
            </div>
            {form.portfolio.length ? (
              form.portfolio.map((item, index) => (
                <div
                  key={`portfolio-${index}`}
                  className="space-y-2 rounded-2xl border border-[color:var(--border)] bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                      {t('profile.portfolioItemLabel', { index: index + 1 })}
                    </p>
                    <Button type="button" variant="outline" onClick={() => removePortfolio(index)}>
                      {t('profile.removeItemAction')}
                    </Button>
                  </div>
                  <Input
                    value={item.name}
                    onChange={(event) => updatePortfolio(index, { name: event.target.value })}
                    placeholder={t('profile.portfolioNamePlaceholder')}
                  />
                  <Input
                    value={item.url}
                    onChange={(event) => updatePortfolio(index, { url: event.target.value })}
                    placeholder={t('profile.portfolioUrlPlaceholder')}
                  />
                  <Textarea
                    value={item.description}
                    onChange={(event) => updatePortfolio(index, { description: event.target.value })}
                    placeholder={t('profile.portfolioDescriptionPlaceholder')}
                    rows={3}
                  />
                </div>
              ))
            ) : (
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                {t('profile.portfolioEmpty')}
              </p>
            )}
          </div>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              {success}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <Link
              href="/dashboard"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--primary)] underline"
            >
              {t('nav.backToDashboard')}
            </Link>
            <Button type="submit" disabled={isLoading || isSaving}>
              {isSaving ? t('common.saving') : t('profile.saveAction')}
            </Button>
          </div>
        </form>
        </Card>
      </div>
    </section>
  );
}
