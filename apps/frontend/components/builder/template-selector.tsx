'use client';

import React from 'react';
import { type TemplateType, TEMPLATE_OPTIONS } from '@/lib/types/template-settings';
import { useTranslations } from '@/lib/i18n';

interface TemplateSelectorProps {
  value: TemplateType;
  onChange: (template: TemplateType) => void;
}

/**
 * Template Selector Component
 *
 * Visual thumbnail buttons for selecting resume templates.
 * Enterprise design: Rounded corners, soft contrast, semantic tokens.
 */
export const TemplateSelector: React.FC<TemplateSelectorProps> = ({ value, onChange }) => {
  const { t } = useTranslations();
  const templateLabels = {
    'swiss-single': {
      name: t('builder.formatting.templates.swissSingle.name'),
      description: t('builder.formatting.templates.swissSingle.description'),
    },
    'swiss-two-column': {
      name: t('builder.formatting.templates.swissTwoColumn.name'),
      description: t('builder.formatting.templates.swissTwoColumn.description'),
    },
    modern: {
      name: t('builder.formatting.templates.modern.name'),
      description: t('builder.formatting.templates.modern.description'),
    },
    'modern-two-column': {
      name: t('builder.formatting.templates.modernTwoColumn.name'),
      description: t('builder.formatting.templates.modernTwoColumn.description'),
    },
  };

  return (
    <div className="flex gap-3">
      {TEMPLATE_OPTIONS.map((template) => (
        <button
          key={template.id}
          onClick={() => onChange(template.id)}
          className={`group flex flex-col items-center rounded-xl border p-3 transition-all ${
            value === template.id
              ? 'border-[color:var(--primary)] bg-white shadow-[0_12px_24px_rgba(15,27,45,0.14)]'
              : 'border-[color:var(--border)] bg-white hover:bg-[var(--surface-muted)]'
          }`}
          title={templateLabels[template.id].description}
        >
          {/* Template Thumbnail */}
          <div className="w-16 h-20 mb-2 flex items-center justify-center">
            <TemplateThumbnail type={template.id} isActive={value === template.id} />
          </div>

          {/* Template Name */}
          <span
            className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
              value === template.id ? 'text-[var(--primary)]' : 'text-[color:var(--text-subtle)]'
            }`}
          >
            {templateLabels[template.id].name}
          </span>
        </button>
      ))}
    </div>
  );
};

/**
 * Template Thumbnail
 *
 * Visual representation of each template layout
 * Exported for use in FormattingControls
 */
interface TemplateThumbnailProps {
  type: TemplateType;
  isActive: boolean;
}

export const TemplateThumbnail: React.FC<TemplateThumbnailProps> = ({ type, isActive }) => {
  const lineColor = isActive ? 'bg-[var(--primary)]' : 'bg-[color:var(--text-subtle)]';
  const borderColor = isActive ? 'border-[color:var(--primary)]' : 'border-[color:var(--border)]';
  const accentColor = isActive ? 'bg-[var(--primary-strong)]' : 'bg-[color:var(--border)]';

  if (type === 'swiss-single') {
    // Single column thumbnail
    return (
      <div className={`w-14 h-18 border ${borderColor} bg-white p-1.5 flex flex-col gap-1`}>
        {/* Header */}
        <div className={`h-2 ${lineColor} w-full`}></div>
        <div className={`h-0.5 ${lineColor} w-3/4`}></div>
        {/* Sections */}
        <div className="flex-1 space-y-1 mt-1">
          <div className={`h-0.5 ${lineColor} w-full`}></div>
          <div className={`h-0.5 ${lineColor} w-5/6 opacity-50`}></div>
          <div className={`h-0.5 ${lineColor} w-4/6 opacity-50`}></div>
          <div className="h-1"></div>
          <div className={`h-0.5 ${lineColor} w-full`}></div>
          <div className={`h-0.5 ${lineColor} w-5/6 opacity-50`}></div>
          <div className={`h-0.5 ${lineColor} w-3/6 opacity-50`}></div>
        </div>
      </div>
    );
  }

  if (type === 'modern') {
    // Modern template thumbnail - with accent color highlights
    return (
      <div className={`w-14 h-18 border ${borderColor} bg-white p-1.5 flex flex-col gap-1`}>
        {/* Header with accent underline */}
        <div className="flex flex-col items-center gap-0.5">
          <div className={`h-2 ${lineColor} w-3/4`}></div>
          <div className={`h-0.5 ${accentColor} w-1/3`}></div>
        </div>
        {/* Sections with accent headers */}
        <div className="flex-1 space-y-1 mt-1">
          <div className={`h-0.5 ${accentColor} w-full`}></div>
          <div className={`h-0.5 ${lineColor} w-5/6 opacity-50`}></div>
          <div className={`h-0.5 ${lineColor} w-4/6 opacity-50`}></div>
          <div className="h-0.5"></div>
          <div className={`h-0.5 ${accentColor} w-full`}></div>
          <div className={`h-0.5 ${lineColor} w-5/6 opacity-50`}></div>
          <div className={`h-0.5 ${lineColor} w-3/6 opacity-50`}></div>
        </div>
      </div>
    );
  }

  if (type === 'modern-two-column') {
    // Modern two-column template thumbnail - accent colors + two columns
    return (
      <div className={`w-14 h-18 border ${borderColor} bg-white p-1.5 flex flex-col gap-1`}>
        {/* Header with accent underline */}
        <div className="flex flex-col items-center gap-0.5">
          <div className={`h-1.5 ${lineColor} w-3/4`}></div>
          <div className={`h-0.5 ${accentColor} w-1/3`}></div>
        </div>
        {/* Two columns */}
        <div className="flex-1 flex gap-1 mt-1">
          {/* Left column (wider) - with accent headers */}
          <div className="w-2/3 space-y-0.5">
            <div className={`h-0.5 ${accentColor} w-full`}></div>
            <div className={`h-0.5 ${lineColor} w-5/6 opacity-50`}></div>
            <div className={`h-0.5 ${lineColor} w-4/6 opacity-50`}></div>
            <div className="h-0.5"></div>
            <div className={`h-0.5 ${accentColor} w-full`}></div>
            <div className={`h-0.5 ${lineColor} w-5/6 opacity-50`}></div>
          </div>
          {/* Right column (narrower) - with accent border and headers */}
          <div
            className={`w-1/3 border-l-2 ${
              isActive ? 'border-l-[color:var(--primary)]' : 'border-l-[color:var(--border)]'
            } pl-1 space-y-0.5`}
          >
            <div className={`h-0.5 ${accentColor} w-full`}></div>
            <div className={`h-0.5 ${lineColor} w-4/5 opacity-50`}></div>
            <div className="h-0.5"></div>
            <div className={`h-0.5 ${accentColor} w-full`}></div>
            <div className={`h-0.5 ${lineColor} w-3/5 opacity-50`}></div>
          </div>
        </div>
      </div>
    );
  }

  // Two column thumbnail (swiss-two-column)
  return (
    <div className={`w-14 h-18 border ${borderColor} bg-white p-1.5 flex flex-col gap-1`}>
      {/* Header - centered */}
      <div className="flex flex-col items-center gap-0.5">
        <div className={`h-1.5 ${lineColor} w-3/4`}></div>
        <div className={`h-0.5 ${lineColor} w-1/2 opacity-70`}></div>
      </div>
      {/* Two columns */}
      <div className="flex-1 flex gap-1 mt-1">
        {/* Left column (wider) */}
        <div className="w-2/3 space-y-0.5">
          <div className={`h-0.5 ${lineColor} w-full`}></div>
          <div className={`h-0.5 ${lineColor} w-5/6 opacity-50`}></div>
          <div className={`h-0.5 ${lineColor} w-4/6 opacity-50`}></div>
          <div className="h-0.5"></div>
          <div className={`h-0.5 ${lineColor} w-full`}></div>
          <div className={`h-0.5 ${lineColor} w-5/6 opacity-50`}></div>
        </div>
        {/* Right column (narrower) */}
        <div className="w-1/3 border-l border-[color:var(--border)] pl-1 space-y-0.5">
          <div className={`h-0.5 ${lineColor} w-full`}></div>
          <div className={`h-0.5 ${lineColor} w-4/5 opacity-50`}></div>
          <div className="h-0.5"></div>
          <div className={`h-0.5 ${lineColor} w-full`}></div>
          <div className={`h-0.5 ${lineColor} w-3/5 opacity-50`}></div>
        </div>
      </div>
    </div>
  );
};

export default TemplateSelector;
