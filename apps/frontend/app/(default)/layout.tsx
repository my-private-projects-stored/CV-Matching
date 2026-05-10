import { ResumePreviewProvider } from '@/components/common/resume_previewer_context';
import { StatusCacheProvider } from '@/lib/context/status-cache';
import { LanguageProvider } from '@/lib/context/language-context';
import { LocalizedErrorBoundary } from '@/components/common/error-boundary';
import { AuthGuard } from '@/components/common/auth-guard';
import { AuthProvider } from '@/lib/context/auth-context';
import { AuthBar } from '@/components/common/auth-bar';
import { SideNav } from '@/components/common/side-nav';

export default function DefaultLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StatusCacheProvider>
        <LanguageProvider>
          <ResumePreviewProvider>
            <LocalizedErrorBoundary>
              <AuthGuard>
                <div className="min-h-screen flex flex-col app-shell">
                  <AuthBar />
                  <div className="flex flex-1">
                    <SideNav />
                    <main className="flex min-h-[calc(100vh-72px)] flex-1 flex-col px-6 py-8 lg:px-10">
                      {children}
                    </main>
                  </div>
                </div>
              </AuthGuard>
            </LocalizedErrorBoundary>
          </ResumePreviewProvider>
        </LanguageProvider>
      </StatusCacheProvider>
    </AuthProvider>
  );
}
