import { describe, it, expect } from 'vitest';
import {
  parseTemplate,
  parsePageSize,
  parseSpacingLevel,
  parseMargin,
  parseBoolean,
  parseHeaderFont,
  parseBodyFont,
  parseAccentColor,
} from '@/app/print/resumes/[id]/page';
import { DEFAULT_TEMPLATE_SETTINGS } from '@/lib/types/template-settings';

describe('print resume query parsing', () => {
  it('parses template and page size with defaults', () => {
    expect(parseTemplate('modern-two-column')).toBe('modern-two-column');
    expect(parseTemplate('unknown')).toBe('swiss-single');

    expect(parsePageSize('LETTER')).toBe('LETTER');
    expect(parsePageSize('letter')).toBe('A4');
  });

  it('clamps spacing and margin values', () => {
    const defaultSection = DEFAULT_TEMPLATE_SETTINGS.spacing.section;
    expect(parseSpacingLevel('5', defaultSection)).toBe(5);
    expect(parseSpacingLevel('0', defaultSection)).toBe(defaultSection);
    expect(parseSpacingLevel('invalid', defaultSection)).toBe(defaultSection);

    const defaultMargin = DEFAULT_TEMPLATE_SETTINGS.margins.top;
    expect(parseMargin('12', defaultMargin)).toBe(12);
    expect(parseMargin('2', defaultMargin)).toBe(5);
    expect(parseMargin('30', defaultMargin)).toBe(25);
    expect(parseMargin('bad', defaultMargin)).toBe(defaultMargin);
  });

  it('parses fonts, accent colors, and booleans', () => {
    expect(parseHeaderFont('mono')).toBe('mono');
    expect(parseHeaderFont('bad')).toBe(DEFAULT_TEMPLATE_SETTINGS.fontSize.headerFont);

    expect(parseBodyFont('serif')).toBe('serif');
    expect(parseBodyFont('bad')).toBe(DEFAULT_TEMPLATE_SETTINGS.fontSize.bodyFont);

    expect(parseAccentColor('green')).toBe('green');
    expect(parseAccentColor('bad')).toBe(DEFAULT_TEMPLATE_SETTINGS.accentColor);

    expect(parseBoolean('true', false)).toBe(true);
    expect(parseBoolean('false', true)).toBe(false);
    expect(parseBoolean(undefined, true)).toBe(true);
  });
});
