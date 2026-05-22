'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Tabs Component
 */

export interface Tab {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface RetroTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export const RetroTabs: React.FC<RetroTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className,
}) => {
  return (
    <div className={cn('flex gap-1 border-b border-[color:var(--border)]', className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isDisabled = tab.disabled;

        return (
          <button
            key={tab.id}
            onClick={() => !isDisabled && onTabChange(tab.id)}
            disabled={isDisabled}
            className={cn(
              'px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-all',
              'rounded-t-xl border border-b-0 border-[color:var(--border)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2',
              isActive && [
                'bg-white text-[var(--foreground)]',
                'shadow-[0_10px_18px_rgba(15,27,45,0.12)]',
                'border-b-white',
              ],
              !isActive &&
                !isDisabled && [
                  'bg-[var(--surface-muted)] text-[color:var(--text-subtle)] hover:text-[var(--foreground)]',
                ],
              isDisabled && [
                'bg-[var(--surface-muted)] text-[color:var(--text-subtle)] opacity-50 cursor-not-allowed',
              ]
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
