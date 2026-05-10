import type { Metadata } from 'next';
import { Fraunces, IBM_Plex_Mono, Manrope } from 'next/font/google';
import './(default)/css/globals.css';

const fraunces = Fraunces({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
});

const manrope = Manrope({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'CV Matching Platform',
  description: 'AI recruitment platform for candidates and employers',
  applicationName: 'CV Matching Platform',
  keywords: ['cv', 'matching', 'recruitment', 'ai', 'employer', 'candidate'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full" suppressHydrationWarning>
      <body
        className={`${fraunces.variable} ${manrope.variable} ${plexMono.variable} antialiased min-h-full bg-[var(--background)] text-[var(--foreground)]`}
      >
        {children}
      </body>
    </html>
  );
}
