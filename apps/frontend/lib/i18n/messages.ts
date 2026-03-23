import type { Locale } from '@/i18n/config';

import en from '@/messages/en.json';
import vi from '@/messages/vi.json';

export type Messages = typeof en;

const allMessages: Record<Locale, Messages> = {
  en,
  vi,
};

export function getMessages(locale: Locale): Messages {
  return allMessages[locale] || allMessages.en;
}
