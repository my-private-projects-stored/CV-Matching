import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormattingControls } from '@/components/builder/formatting-controls';
import { DEFAULT_TEMPLATE_SETTINGS } from '@/lib/types/template-settings';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === 'builder.formatting.effectiveMargins' && params) {
        return `margins:${params.top}/${params.bottom}/${params.left}/${params.right}`;
      }
      return key;
    },
  }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span>ChevronDown</span>,
  ChevronUp: () => <span>ChevronUp</span>,
  RotateCcw: () => <span>RotateCcw</span>,
}));

describe('FormattingControls', () => {
  const renderControls = (initialSettings = DEFAULT_TEMPLATE_SETTINGS) => {
    const onChange = vi.fn();

    const Harness = () => {
      const [settings, setSettings] = useState(initialSettings);

      return (
        <FormattingControls
          settings={settings}
          onChange={(nextSettings) => {
            onChange(nextSettings);
            setSettings(nextSettings);
          }}
        />
      );
    };

    return { onChange, ...render(<Harness />) };
  };

  it('renders the default formatting summary', () => {
    renderControls();

    expect(
      screen.getByText((_, element) => element?.textContent === 'margins:10/10/10/10')
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        element?.textContent === 'builder.formatting.effectiveSectionGap: 1rem'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === 'builder.formatting.effectiveItemGap: 0.25rem')
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === 'builder.formatting.effectiveLineHeight: 1.35')
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === 'builder.formatting.effectiveBaseFont: 14px')
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === 'builder.formatting.effectiveHeaderScale: 2x')
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        element?.textContent ===
        'builder.formatting.effectiveHeaderFont: builder.formatting.fontNames.serif'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        element?.textContent === 'builder.formatting.effectiveBodyFont: builder.formatting.fontNames.sans'
      )
    ).toBeInTheDocument();
  });

  it('updates the main formatting controls and resets cleanly', () => {
    const { onChange } = renderControls();

    fireEvent.click(screen.getByTitle('8.5 × 11 in'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageSize: 'LETTER' })
    );

    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '18' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ margins: expect.objectContaining({ top: 18 }) })
    );

    fireEvent.click(
      screen.getByText('builder.formatting.spacingSection:').parentElement!.querySelectorAll('button')[4]
    );
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ spacing: expect.objectContaining({ section: 5 }) })
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'builder.formatting.fontNames.mono' })[0]);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ fontSize: expect.objectContaining({ headerFont: 'mono' }) })
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'builder.formatting.fontNames.mono' })[1]);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ fontSize: expect.objectContaining({ bodyFont: 'mono' }) })
    );

    fireEvent.click(screen.getByText('builder.formatting.compactMode').closest('label')!.querySelector('button')!);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ compactMode: true })
    );

    fireEvent.click(screen.getByText('builder.formatting.contactIcons').closest('label')!.querySelector('button')!);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ showContactIcons: true })
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'builder.formatting.templates.modern.name' })
    );
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ template: 'modern' })
    );

    expect(
      screen.getByRole('button', { name: 'builder.formatting.accentColors.green' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'builder.formatting.accentColors.green' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ accentColor: 'green' })
    );

    fireEvent.click(screen.getByRole('button', { name: /builder\.formatting\.resetDefaults/i }));
    expect(onChange).toHaveBeenLastCalledWith(DEFAULT_TEMPLATE_SETTINGS);
  }, 15000);

  it('updates effective output when compact mode is enabled', () => {
    renderControls();

    expect(
      screen.queryByRole('button', { name: 'builder.formatting.accentColors.green' })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen
        .getByText('builder.formatting.compactMode')
        .closest('label')!
        .querySelector('button')!
    );

    expect(
      screen.getByText((_, element) =>
        element?.textContent === 'builder.formatting.effectiveSectionGap: 0.6rem'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        element?.textContent === 'builder.formatting.effectiveItemGap: 0.15rem'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        element?.textContent === 'builder.formatting.effectiveLineHeight: 1.24'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('builder.formatting.compactHint')).toBeInTheDocument();
  });
});
