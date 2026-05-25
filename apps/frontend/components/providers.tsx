'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/context/auth-context';
import { LanguageProvider } from '@/lib/context/language-context';
import { StatusCacheProvider } from '@/lib/context/status-cache';
import { HtmlLangSync } from '@/components/common/HtmlLangSync';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <HtmlLangSync />
        <StatusCacheProvider>{children}</StatusCacheProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
