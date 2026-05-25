import type { ReactNode } from 'react';
import { AuthLayout } from '@/components/layout/AuthLayout';

export default function AuthRootLayout({ children }: { children: ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
