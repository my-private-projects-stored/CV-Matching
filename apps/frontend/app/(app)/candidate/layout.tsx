import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';

export default function CandidateLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell role="candidate" breadcrumb="candidate">
      {children}
    </AppShell>
  );
}
