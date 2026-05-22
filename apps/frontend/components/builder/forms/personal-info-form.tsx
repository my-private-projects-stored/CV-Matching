'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PersonalInfo } from '@/components/dashboard/resume-component';
import { useTranslations } from '@/lib/i18n';

interface PersonalInfoFormProps {
  data: PersonalInfo;
  onChange: (data: PersonalInfo) => void;
}

export const PersonalInfoForm: React.FC<PersonalInfoFormProps> = ({ data, onChange }) => {
  const { t } = useTranslations();

  const handleChange = (field: keyof PersonalInfo, value: string) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-[color:var(--border)] p-6 bg-white shadow-[0_16px_28px_rgba(15,27,45,0.12)]">
      <h3 className="font-serif text-xl font-bold border-b border-[color:var(--border)] pb-2 mb-4">
        {t('builder.personalInfo')}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label
            htmlFor="name"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]"
          >
            {t('resume.personalInfo.name')}
          </Label>
          <Input
            id="name"
            value={data.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder={t('builder.personalInfoForm.placeholders.name')}
            className="rounded-xl border-[color:var(--border)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--primary)] bg-transparent"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="title"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]"
          >
            {t('resume.personalInfo.title')}
          </Label>
          <Input
            id="title"
            value={data.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder={t('builder.personalInfoForm.placeholders.title')}
            className="rounded-xl border-[color:var(--border)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--primary)] bg-transparent"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="email"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]"
          >
            {t('resume.personalInfo.email')}
          </Label>
          <Input
            id="email"
            type="email"
            value={data.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder={t('builder.personalInfoForm.placeholders.email')}
            className="rounded-xl border-[color:var(--border)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--primary)] bg-transparent"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="phone"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]"
          >
            {t('resume.personalInfo.phone')}
          </Label>
          <Input
            id="phone"
            type="tel"
            value={data.phone || ''}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder={t('builder.personalInfoForm.placeholders.phone')}
            className="rounded-xl border-[color:var(--border)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--primary)] bg-transparent"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="location"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]"
          >
            {t('resume.personalInfo.location')}
          </Label>
          <Input
            id="location"
            value={data.location || ''}
            onChange={(e) => handleChange('location', e.target.value)}
            placeholder={t('builder.personalInfoForm.placeholders.location')}
            className="rounded-xl border-[color:var(--border)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--primary)] bg-transparent"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="website"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]"
          >
            {t('resume.personalInfo.website')}
          </Label>
          <Input
            id="website"
            value={data.website || ''}
            onChange={(e) => handleChange('website', e.target.value)}
            placeholder={t('builder.personalInfoForm.placeholders.website')}
            className="rounded-xl border-[color:var(--border)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--primary)] bg-transparent"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="linkedin"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]"
          >
            {t('resume.personalInfo.linkedin')}
          </Label>
          <Input
            id="linkedin"
            value={data.linkedin || ''}
            onChange={(e) => handleChange('linkedin', e.target.value)}
            placeholder={t('builder.personalInfoForm.placeholders.linkedin')}
            className="rounded-xl border-[color:var(--border)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--primary)] bg-transparent"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="github"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]"
          >
            {t('resume.personalInfo.github')}
          </Label>
          <Input
            id="github"
            value={data.github || ''}
            onChange={(e) => handleChange('github', e.target.value)}
            placeholder={t('builder.personalInfoForm.placeholders.github')}
            className="rounded-xl border-[color:var(--border)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--primary)] bg-transparent"
          />
        </div>
      </div>
    </div>
  );
};
