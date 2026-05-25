'use client';

import { useEffect } from 'react';
import { useLanguage } from '@/lib/context/language-context';

export function HtmlLangSync() {
  const { uiLanguage } = useLanguage();

  useEffect(() => {
    document.documentElement.lang = uiLanguage;
  }, [uiLanguage]);

  return null;
}
