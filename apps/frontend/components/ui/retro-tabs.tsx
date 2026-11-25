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
    <div
      className={cn(
        'inline-flex flex-wrap items-center gap-1 rounded-xl border border-[color:var(--border)] bg-[var(--surface-muted)] p-1',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isDisabled = tab.disabled;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => !isDisabled && onTabChange(tab.id)}
            disabled={isDisabled}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1',
              isActive && 'bg-white font-semibold text-[var(--blue-700)] shadow-sm',
              !isActive &&
                !isDisabled &&
                'text-[var(--text-2)] hover:bg-white/60 hover:text-[var(--text-1)]',
              isDisabled && 'cursor-not-allowed text-[var(--text-3)] opacity-50'
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
