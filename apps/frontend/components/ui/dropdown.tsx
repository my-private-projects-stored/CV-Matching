'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

export interface DropdownOption {
  id: string;
  label: string;
  description?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function Dropdown({
  options,
  value,
  onChange,
  label,
  description,
  disabled = false,
  className = '',
}: DropdownProps) {
  const { t } = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
  };

  return (
    <div className={`space-y-1 ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
          {label}
        </label>
      )}

      {description && <p className="text-sm text-[color:var(--text-subtle)]">{description}</p>}

      <div className="relative">
        {/* Trigger Button */}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="flex w-full items-center justify-between rounded-xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm transition-all duration-150 ease-out shadow-[0_10px_20px_rgba(15,27,45,0.08)] hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(15,27,45,0.14)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="flex-1 text-left min-w-0">
            {selectedOption ? (
              <div>
                <div className="truncate font-semibold text-[var(--foreground)]">
                  {selectedOption.label}
                </div>
                {selectedOption.description && (
                  <div className="mt-1 truncate text-xs text-[color:var(--text-subtle)]">
                    {selectedOption.description}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-[color:var(--text-subtle)]">{t('common.selectOption')}</span>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ml-2 shrink-0 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-[color:var(--border)] bg-white shadow-[0_16px_28px_rgba(15,27,45,0.16)]">
            <div className="max-h-64 overflow-y-auto">
              {options.map((option, index) => (
                <React.Fragment key={option.id}>
                  <button
                    onClick={() => handleSelect(option.id)}
                    className={`w-full px-4 py-3 text-left transition-colors duration-150 ${
                      option.id === value
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-white text-[var(--foreground)] hover:bg-[var(--surface-muted)]'
                    } ${index > 0 ? 'border-t border-[color:var(--border)]' : ''} active:bg-[var(--surface-muted)]`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{option.label}</div>
                        {option.description && (
                          <div className="text-xs mt-1 opacity-80">{option.description}</div>
                        )}
                      </div>
                      {option.id === value && <div className="text-lg font-bold mt-0.5">✓</div>}
                    </div>
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
