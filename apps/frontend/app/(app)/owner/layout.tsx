import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell role="platform_owner" breadcrumb="owner">
      {children}
    </AppShell>
  );
}
