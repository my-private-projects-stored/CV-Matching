import { ResumePreviewProvider } from '@/components/common/resume_previewer_context';
import { StatusCacheProvider } from '@/lib/context/status-cache';
import { LanguageProvider } from '@/lib/context/language-context';
import { LocalizedErrorBoundary } from '@/components/common/error-boundary';
import { AuthGuard } from '@/components/common/auth-guard';
import { AuthProvider } from '@/lib/context/auth-context';

export default function DefaultLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StatusCacheProvider>
        <LanguageProvider>
          <ResumePreviewProvider>
            <LocalizedErrorBoundary>
              <AuthGuard>
                <main className="min-h-screen flex flex-col">{children}</main>
              </AuthGuard>
            </LocalizedErrorBoundary>
          </ResumePreviewProvider>
        </LanguageProvider>
      </StatusCacheProvider>
    </AuthProvider>
  );
}
