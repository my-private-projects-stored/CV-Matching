import type { Locale } from '@/i18n/config';

export const UI_LANGUAGE_COOKIE = 'resume_matcher_ui_language';

export function syncLocaleCookie(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.cookie = `${UI_LANGUAGE_COOKIE}=${locale};path=/;max-age=31536000;SameSite=Lax`;
}
