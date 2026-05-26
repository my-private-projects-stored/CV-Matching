'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/context/auth-context';
import { LanguageProvider } from '@/lib/context/language-context';
import { StatusCacheProvider } from '@/lib/context/status-cache';
import { HtmlLangSync } from '@/components/common/HtmlLangSync';
import { ResumePreviewProvider } from '@/components/common/resume_previewer_context';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <HtmlLangSync />
        <StatusCacheProvider>
          <ResumePreviewProvider>{children}</ResumePreviewProvider>
        </StatusCacheProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
