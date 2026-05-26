import type { Metadata } from 'next';
import '../styles/globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'CV Matching - AI Recruitment Platform',
  description: 'AI recruitment platform connecting candidates and companies.',
  applicationName: 'CV Matching',
  keywords: ['cv', 'recruitment', 'candidate', 'company', 'ai', 'matching'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-[var(--bg)] text-[var(--text-1)] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
