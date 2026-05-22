import { describe, it, expect } from 'vitest';
import { DEFAULT_TEMPLATE_SETTINGS, settingsToCssVars } from '@/lib/types/template-settings';

describe('template settings output', () => {
  it('maps default settings to CSS variables', () => {
    const vars = settingsToCssVars(DEFAULT_TEMPLATE_SETTINGS) as Record<string, string | number>;

    expect(vars['--section-gap']).toBe('1rem');
    expect(vars['--item-gap']).toBe('0.25rem');
    expect(Number(vars['--line-height'])).toBeCloseTo(1.35, 2);
    expect(vars['--font-size-base']).toBe('14px');
    expect(vars['--header-scale']).toBe(2);
    expect(String(vars['--header-font'])).toContain('ui-serif');
    expect(vars['--margin-top']).toBe('10mm');
    expect(vars['--resume-accent-primary']).toBe('#1D4ED8');
  });

  it('applies compact spacing and accent color overrides', () => {
    const vars = settingsToCssVars({
      ...DEFAULT_TEMPLATE_SETTINGS,
      compactMode: true,
      spacing: {
        ...DEFAULT_TEMPLATE_SETTINGS.spacing,
        section: 4,
        item: 5,
        lineHeight: 2,
      },
      fontSize: {
        ...DEFAULT_TEMPLATE_SETTINGS.fontSize,
        headerFont: 'mono',
        bodyFont: 'mono',
      },
      margins: { top: 12, bottom: 14, left: 16, right: 18 },
      accentColor: 'green',
    }) as Record<string, string | number>;

    expect(vars['--section-gap']).toBe('calc(1.25rem * 0.6)');
    expect(vars['--item-gap']).toBe('calc(1rem * 0.6)');
    expect(Number(vars['--line-height'])).toBeCloseTo(1.25 * 0.92, 3);
    expect(String(vars['--header-font'])).toContain('monospace');
    expect(String(vars['--body-font'])).toContain('monospace');
    expect(vars['--margin-top']).toBe('12mm');
    expect(vars['--margin-right']).toBe('18mm');
    expect(vars['--resume-accent-primary']).toBe('#15803D');
  });
});
