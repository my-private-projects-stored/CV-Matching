'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/lib/i18n';

interface GenericTextFormProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

/**
 * Generic Text Form Component
 *
 * Used for TEXT type sections (like Summary).
 * Renders a single textarea for text content.
 */
export const GenericTextForm: React.FC<GenericTextFormProps> = ({
  value,
  onChange,
  label,
  placeholder,
}) => {
  const { t } = useTranslations();
  const finalLabel = label ?? t('builder.customSections.contentLabel');
  const finalPlaceholder = placeholder ?? t('builder.customSections.defaultTextPlaceholder');

  // Explicitly allow Enter key to create newlines
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
        {finalLabel}
      </Label>
      <Textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={finalPlaceholder}
        className="min-h-[150px] text-[var(--foreground)] rounded-2xl border border-[color:var(--border)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--primary)] bg-white"
      />
    </div>
  );
};
