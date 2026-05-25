'use client';

import { useTranslations } from './translations';

/** Resolve translated page title/subtitle from `pages.{key}.title|subtitle` */
export function usePageHeader(pageKey: string, params?: Record<string, string | number>) {
  const { t } = useTranslations();
  return {
    title: t(`pages.${pageKey}.title`),
    subtitle: t(`pages.${pageKey}.subtitle`, params),
  };
}
