import type { Metadata } from 'next';
import './(default)/css/globals.css';

export const metadata: Metadata = {
  title: 'CV Matching - Cầu nối tuyển dụng AI',
  description: 'Nền tảng tuyển dụng kết nối ứng viên và doanh nghiệp bằng AI.',
  applicationName: 'CV Matching',
  keywords: ['cv', 'tuyển dụng', 'ứng viên', 'doanh nghiệp', 'ai', 'matching'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full" suppressHydrationWarning>
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] antialiased">
        {children}
      </body>
    </html>
  );
}
