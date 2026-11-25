'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import {
  type TemplateSettings,
  type TemplateType,
  type PageSize,
  type SpacingLevel,
  type HeaderFontFamily,
  type BodyFontFamily,
  type AccentColor,
  DEFAULT_TEMPLATE_SETTINGS,
  SECTION_SPACING_MAP,
  ITEM_SPACING_MAP,
  LINE_HEIGHT_MAP,
  FONT_SIZE_MAP,
  HEADER_SCALE_MAP,
  COMPACT_MULTIPLIER,
  COMPACT_LINE_HEIGHT_MULTIPLIER,
  TEMPLATE_OPTIONS,
  PAGE_SIZE_INFO,
  ACCENT_COLOR_MAP,
} from '@/lib/types/template-settings';
import { TemplateThumbnail } from './template-selector';
import { useTranslations } from '@/lib/i18n';

interface FormattingControlsProps {
  settings: TemplateSettings;
  onChange: (settings: TemplateSettings) => void;
}

/**
 * Formatting Controls Panel
 *
 * Provides user controls for adjusting resume layout:
 * - Template selection with visual thumbnails
 * - Page size (A4 / US Letter)
 * - Margins (top, bottom, left, right)
 * - Section/item spacing
 * - Line height
 * - Font sizes
 *
 * Swiss design: Square buttons, monospace labels, high contrast
 */
export const FormattingControls: React.FC<FormattingControlsProps> = ({ settings, onChange }) => {
  const { t } = useTranslations();
  const [isExpanded, setIsExpanded] = useState(false);
  const compactMultiplier = settings.compactMode ? COMPACT_MULTIPLIER : 1;
  const sectionGapRem =
    parseFloat(SECTION_SPACING_MAP[settings.spacing.section]) * compactMultiplier;
  const itemGapRem = parseFloat(ITEM_SPACING_MAP[settings.spacing.item]) * compactMultiplier;
  const lineHeightValue = settings.compactMode
    ? LINE_HEIGHT_MAP[settings.spacing.lineHeight] * COMPACT_LINE_HEIGHT_MULTIPLIER
    : LINE_HEIGHT_MAP[settings.spacing.lineHeight];

  const formatRem = (value: number) =>
    `${value.toFixed(2).replace(/\.00$/, '').replace(/0$/, '')}rem`;

  const handleTemplateChange = (template: TemplateType) => {
    onChange({ ...settings, template });
  };

  const handlePageSizeChange = (pageSize: PageSize) => {
    onChange({ ...settings, pageSize });
  };

  const handleMarginChange = (key: keyof TemplateSettings['margins'], value: number) => {
    onChange({
      ...settings,
      margins: { ...settings.margins, [key]: value },
    });
  };

  const handleSpacingChange = (key: keyof TemplateSettings['spacing'], value: SpacingLevel) => {
    onChange({
      ...settings,
      spacing: { ...settings.spacing, [key]: value },
    });
  };

  const handleFontChange = (key: keyof TemplateSettings['fontSize'], value: SpacingLevel) => {
    onChange({
      ...settings,
      fontSize: { ...settings.fontSize, [key]: value },
    });
  };

  const handleHeaderFontChange = (headerFont: HeaderFontFamily) => {
    onChange({
      ...settings,
      fontSize: { ...settings.fontSize, headerFont },
    });
  };

  const handleBodyFontChange = (bodyFont: BodyFontFamily) => {
    onChange({
      ...settings,
      fontSize: { ...settings.fontSize, bodyFont },
    });
  };

  const handleCompactModeToggle = () => {
    onChange({ ...settings, compactMode: !settings.compactMode });
  };

  const handleShowContactIconsToggle = () => {
    onChange({ ...settings, showContactIcons: !settings.showContactIcons });
  };

  const handleAccentColorChange = (accentColor: AccentColor) => {
    onChange({ ...settings, accentColor });
  };

  const handleReset = () => {
    onChange(DEFAULT_TEMPLATE_SETTINGS);
  };

  const templateLabels = React.useMemo(
    () => ({
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
    }),
    [t]
  );

  const getFontLabel = (font: HeaderFontFamily | BodyFontFamily) => {
    if (font === 'sans-serif') return t('builder.formatting.fontNames.sans');
    if (font === 'serif') return t('builder.formatting.fontNames.serif');
    return t('builder.formatting.fontNames.mono');
  };

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white shadow-[var(--shadow-elev-1)] overflow-hidden">
      {/* Header - Always Visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/70 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-[var(--blue-700)]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-1)]">
            {t('builder.formatting.panelTitle')}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="hidden sm:inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-2)]">
            {templateLabels[settings.template]?.name} · {settings.pageSize}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-[var(--text-3)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--text-3)]" />
          )}
        </div>
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="border-t border-[var(--border)] p-5 space-y-6">
          {/* Template Selection */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 text-[var(--text-2)]">
              {t('builder.formatting.template')}
            </h4>
            <div className="flex flex-wrap gap-3">
              {TEMPLATE_OPTIONS.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateChange(template.id)}
                  className={`group flex flex-col items-center p-2.5 rounded-xl border transition-all ${
                    settings.template === template.id
                      ? 'border-[var(--blue-700)] bg-[var(--blue-50)]/60 ring-2 ring-[var(--blue-700)]/15'
                      : 'border-[var(--border)] bg-white hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                  title={templateLabels[template.id].description}
                >
                  <div className="w-12 h-16 mb-1.5 flex items-center justify-center">
                    <TemplateThumbnail
                      type={template.id}
                      isActive={settings.template === template.id}
                    />
                  </div>
                  <span
                    className={`text-[11px] font-semibold ${
                      settings.template === template.id
                        ? 'text-[var(--blue-700)]'
                        : 'text-[var(--text-2)]'
                    }`}
                  >
                    {templateLabels[template.id].name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color Selection - Visible for Modern templates */}
          {(settings.template === 'modern' || settings.template === 'modern-two-column') && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 text-[var(--text-2)]">
                {t('builder.formatting.accentColor')}
              </h4>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(ACCENT_COLOR_MAP) as AccentColor[]).map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleAccentColorChange(color)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                      settings.accentColor === color
                        ? 'border-[var(--blue-700)] bg-[var(--blue-50)]/60 text-[var(--blue-700)] ring-2 ring-[var(--blue-700)]/15'
                        : 'border-[var(--border)] bg-white text-[var(--text-2)] hover:bg-slate-50'
                    }`}
                    title={t(`builder.formatting.accentColors.${color}`)}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-slate-300"
                      style={{ backgroundColor: ACCENT_COLOR_MAP[color].primary }}
                    />
                    <span>{t(`builder.formatting.accentColors.${color}`)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Page Size Selection */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 text-[var(--text-2)]">
              {t('builder.formatting.pageSize')}
            </h4>
            <div className="flex gap-2.5">
              {(Object.keys(PAGE_SIZE_INFO) as PageSize[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handlePageSizeChange(size)}
                  className={`flex-1 px-3 py-2 rounded-xl border text-xs transition-all ${
                    settings.pageSize === size
                      ? 'border-[var(--blue-700)] bg-[var(--blue-50)]/60 text-[var(--blue-700)] ring-2 ring-[var(--blue-700)]/15'
                      : 'border-[var(--border)] bg-white text-[var(--text-2)] hover:bg-slate-50'
                  }`}
                  title={PAGE_SIZE_INFO[size].dimensions}
                >
                  <div className="font-semibold">
                    {size === 'A4' ? 'A4' : t('builder.pageSize.usLetter')}
                  </div>
                  <div className="font-mono text-[10px] opacity-75">
                    {PAGE_SIZE_INFO[size].dimensions}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Margins Section */}
          <div>
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider mb-3 text-gray-600">
              {t('builder.formatting.margins')}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <MarginSlider
                label={t('builder.formatting.margin.top')}
                value={settings.margins.top}
                onChange={(v) => handleMarginChange('top', v)}
              />
              <MarginSlider
                label={t('builder.formatting.margin.bottom')}
                value={settings.margins.bottom}
                onChange={(v) => handleMarginChange('bottom', v)}
              />
              <MarginSlider
                label={t('builder.formatting.margin.left')}
                value={settings.margins.left}
                onChange={(v) => handleMarginChange('left', v)}
              />
              <MarginSlider
                label={t('builder.formatting.margin.right')}
                value={settings.margins.right}
                onChange={(v) => handleMarginChange('right', v)}
              />
            </div>
          </div>

          {/* Spacing Section */}
          <div>
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider mb-3 text-gray-600">
              {t('builder.formatting.spacing')}
            </h4>
            <div className="space-y-3">
              <SpacingSelector
                label={t('builder.formatting.spacingSection')}
                value={settings.spacing.section}
                onChange={(v) => handleSpacingChange('section', v)}
              />
              <SpacingSelector
                label={t('builder.formatting.spacingItems')}
                value={settings.spacing.item}
                onChange={(v) => handleSpacingChange('item', v)}
              />
              <SpacingSelector
                label={t('builder.formatting.spacingLines')}
                value={settings.spacing.lineHeight}
                onChange={(v) => handleSpacingChange('lineHeight', v)}
              />
            </div>
          </div>

          {/* Font Size Section */}
          <div>
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider mb-3 text-gray-600">
              {t('builder.formatting.fontSize')}
            </h4>
            <div className="space-y-3">
              <SpacingSelector
                label={t('builder.formatting.baseFontSize')}
                value={settings.fontSize.base}
                onChange={(v) => handleFontChange('base', v)}
              />
              <SpacingSelector
                label={t('builder.formatting.headerScale')}
                value={settings.fontSize.headerScale}
                onChange={(v) => handleFontChange('headerScale', v)}
              />
              {/* Header Font Family */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs w-16 text-gray-600">
                  {t('builder.formatting.headerFontFamily')}:
                </span>
                <div className="flex gap-1">
                  {(['serif', 'sans-serif', 'mono'] as HeaderFontFamily[]).map((font) => (
                    <button
                      key={font}
                      onClick={() => handleHeaderFontChange(font)}
                      className={`px-2 py-1 font-mono text-xs border transition-all ${
                        settings.fontSize.headerFont === font
                          ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-[var(--border)]'
                      }`}
                      style={{
                        fontFamily:
                          font === 'serif'
                            ? 'Georgia, serif'
                            : font === 'mono'
                              ? 'monospace'
                              : 'system-ui, sans-serif',
                      }}
                    >
                      {getFontLabel(font)}
                    </button>
                  ))}
                </div>
              </div>
              {/* Body Font Family */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs w-16 text-gray-600">
                  {t('builder.formatting.bodyFontFamily')}:
                </span>
                <div className="flex gap-1">
                  {(['serif', 'sans-serif', 'mono'] as BodyFontFamily[]).map((font) => (
                    <button
                      key={font}
                      onClick={() => handleBodyFontChange(font)}
                      className={`px-2 py-1 font-mono text-xs border transition-all ${
                        settings.fontSize.bodyFont === font
                          ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-[var(--border)]'
                      }`}
                      style={{
                        fontFamily:
                          font === 'serif'
                            ? 'Georgia, serif'
                            : font === 'mono'
                              ? 'monospace'
                              : 'system-ui, sans-serif',
                      }}
                    >
                      {getFontLabel(font)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Options Section */}
          <div>
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider mb-3 text-gray-600">
              {t('builder.formatting.options')}
            </h4>
            <div className="space-y-3">
              {/* Compact Mode Toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={handleCompactModeToggle}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    settings.compactMode ? 'bg-[var(--blue-700)]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                      settings.compactMode ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
                <span className="text-xs font-medium text-[var(--text-2)]">
                  {t('builder.formatting.compactMode')}
                </span>
              </label>

              {/* Show Contact Icons Toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={handleShowContactIconsToggle}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    settings.showContactIcons ? 'bg-[var(--blue-700)]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                      settings.showContactIcons ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
                <span className="text-xs font-medium text-[var(--text-2)]">
                  {t('builder.formatting.contactIcons')}
                </span>
              </label>
            </div>
          </div>

          {/* Reset Button */}
          <div className="pt-2 border-t border-gray-200 space-y-3">
            <div>
              <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-2">
                {t('builder.formatting.effectiveOutput')}
              </h4>
              <div className="font-mono text-[10px] text-gray-600 space-y-1">
                <div title={t('builder.formatting.margins')}>
                  {t('builder.formatting.effectiveMargins', {
                    top: settings.margins.top,
                    bottom: settings.margins.bottom,
                    left: settings.margins.left,
                    right: settings.margins.right,
                  })}
                </div>
                <div>
                  {t('builder.formatting.effectiveSectionGap')}: {formatRem(sectionGapRem)}
                </div>
                <div>
                  {t('builder.formatting.effectiveItemGap')}: {formatRem(itemGapRem)}
                </div>
                <div>
                  {t('builder.formatting.effectiveLineHeight')}: {lineHeightValue.toFixed(2)}
                </div>
                <div>
                  {t('builder.formatting.effectiveBaseFont')}:{' '}
                  {FONT_SIZE_MAP[settings.fontSize.base]}
                </div>
                <div>
                  {t('builder.formatting.effectiveHeaderScale')}:{' '}
                  {HEADER_SCALE_MAP[settings.fontSize.headerScale]}x
                </div>
                <div>
                  {t('builder.formatting.effectiveHeaderFont')}:{' '}
                  {getFontLabel(settings.fontSize.headerFont)}
                </div>
                <div>
                  {t('builder.formatting.effectiveBodyFont')}:{' '}
                  {getFontLabel(settings.fontSize.bodyFont)}
                </div>
              </div>
              {settings.compactMode && (
                <div className="font-mono text-[10px] text-gray-500 mt-2">
                  {t('builder.formatting.compactHint')}
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleReset} className="w-full">
              <RotateCcw className="w-3 h-3" />
              {t('builder.formatting.resetDefaults')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Margin Slider Component
 *
 * Range input for margin values (5-25mm)
 */
interface MarginSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

const MarginSlider: React.FC<MarginSliderProps> = ({ label, value, onChange }) => {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs w-12 text-gray-600">{label}:</span>
      <input
        type="range"
        min={5}
        max={25}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="flex-1 h-1.5 bg-slate-200 rounded-full accent-[var(--blue-700)] cursor-pointer"
      />
      <span className="font-mono text-xs w-6 text-right text-gray-800">{value}</span>
    </div>
  );
};

/**
 * Spacing Selector Component
 *
 * Button group for selecting spacing levels (1-5)
 */
interface SpacingSelectorProps {
  label: string;
  value: SpacingLevel;
  onChange: (value: SpacingLevel) => void;
}

const SpacingSelector: React.FC<SpacingSelectorProps> = ({ label, value, onChange }) => {
  const levels: SpacingLevel[] = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs w-16 text-gray-600">{label}:</span>
      <div className="flex gap-1">
        {levels.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={`w-8 h-7 rounded-lg font-mono text-xs border transition-all ${
              value === level
                ? 'bg-[var(--blue-700)] text-white border-[var(--blue-700)] shadow-sm'
                : 'bg-white text-[var(--text-2)] border-[var(--border)] hover:border-slate-300'
            }`}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FormattingControls;
