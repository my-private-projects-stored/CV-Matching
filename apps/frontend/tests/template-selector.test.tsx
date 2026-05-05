import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TemplateSelector } from '@/components/builder/template-selector';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

describe('TemplateSelector', () => {
  it('renders all template options and calls onChange when selected', () => {
    const onChange = vi.fn();

    render(<TemplateSelector value="swiss-single" onChange={onChange} />);

    expect(
      screen.getByRole('button', { name: 'builder.formatting.templates.swissSingle.name' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'builder.formatting.templates.swissTwoColumn.name',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'builder.formatting.templates.modern.name' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'builder.formatting.templates.modernTwoColumn.name',
      })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'builder.formatting.templates.modernTwoColumn.name' })
    );

    expect(onChange).toHaveBeenCalledWith('modern-two-column');
  });
});
