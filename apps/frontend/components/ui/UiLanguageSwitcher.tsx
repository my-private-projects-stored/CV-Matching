'use client';

import { useLanguage } from '@/lib/context/language-context';
import { useTranslations } from '@/lib/i18n/translations';
import type { Locale } from '@/i18n/config';

export function UiLanguageSwitcher({ className }: { className?: string }) {
  const { uiLanguage, setUiLanguage, languageNames, supportedLanguages } = useLanguage();
  const { t } = useTranslations();

  return (
    <select
      aria-label={t('common.uiLanguage')}
      className={className}
      value={uiLanguage}
      onChange={(event) => setUiLanguage(event.target.value as Locale)}
    >
      {supportedLanguages.map((locale) => (
        <option key={locale} value={locale}>
          {languageNames[locale]}
        </option>
      ))}
    </select>
  );
}
