'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Enterprise Toggle Switch Component
 *
 * Design Principles:
 * - Rounded panels
 * - Soft contrast states
 * - Clear label and description
 */

export interface ToggleSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  className,
}) => {
  const labelId = React.useId();

  const handleToggle = () => {
    if (!disabled) {
      onCheckedChange(!checked);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-white p-4',
        'shadow-[0_10px_20px_rgba(15,27,45,0.08)]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div className="flex-1 mr-4">
        <div id={labelId} className="text-sm font-semibold uppercase tracking-[0.2em]">
          {label}
        </div>
        {description && (
          <div className="mt-1 text-xs text-[color:var(--text-subtle)]">{description}</div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          'relative inline-flex h-6 w-12 shrink-0 cursor-pointer items-center rounded-full',
          'border border-[color:var(--border)] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed',
          checked ? 'bg-blue-600' : 'bg-[var(--surface-muted)]'
        )}
      >
        <span
          className={cn(
            'pointer-events-none block h-4 w-4 rounded-full bg-white border border-[color:var(--border)] shadow-sm',
            'transition-transform duration-200',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
};
