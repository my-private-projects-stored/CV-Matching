import { describe, expect, it } from 'vitest';

import { locales } from '@/i18n/config';
import { getMessages } from '@/lib/i18n/messages';

describe('localized messages', () => {
  it('loads en and vi locales only', () => {
    expect(locales).toEqual(['en', 'vi']);

    for (const locale of locales) {
      const messages = getMessages(locale);
      expect(messages).toBeTruthy();
      expect(Object.keys(messages).length).toBeGreaterThan(0);
    }
  });
});
