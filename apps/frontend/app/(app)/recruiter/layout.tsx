import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';

export default function RecruiterLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell role="recruiter" breadcrumb="recruiter">
      {children}
    </AppShell>
  );
}
