import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResumeForm } from '@/components/builder/resume-form';
import { SectionHeader } from '@/components/builder/section-header';
import type { ResumeData, SectionMeta } from '@/components/dashboard/resume-component';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.name) {
        return `${key}:${params.name}`;
      }

      if (params?.type) {
        return `${key}:${params.type}`;
      }

      return key;
    },
  }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    onOpenChange,
    onConfirm,
  }: {
    open: boolean;
    title?: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <p>{title}</p>
        <p>{description}</p>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </button>
      </div>
    ) : null,
}));

vi.mock('@/components/builder/draggable-section-wrapper', () => ({
  DraggableSectionWrapper: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/builder/add-section-dialog', () => ({
  AddSectionButton: ({ onAdd }: { onAdd: (displayName: string, sectionType: string) => void }) => (
    <button type="button" onClick={() => onAdd('Testimonials', 'text')}>
      Add custom section
    </button>
  ),
}));

vi.mock('@/components/builder/forms/personal-info-form', () => ({
  PersonalInfoForm: ({
    data,
    onChange,
  }: {
    data: { name?: string };
    onChange: (value: { name?: string }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onChange({ ...data, name: `${data.name ?? 'Name'} Updated` })}
    >
      Update personal info
    </button>
  ),
}));

vi.mock('@/components/builder/forms/summary-form', () => ({
  SummaryForm: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <button type="button" onClick={() => onChange(`${value} updated`)}>
      Update summary
    </button>
  ),
}));

vi.mock('@/components/builder/forms/experience-form', () => ({
  ExperienceForm: () => <div>Experience form</div>,
}));

vi.mock('@/components/builder/forms/education-form', () => ({
  EducationForm: () => <div>Education form</div>,
}));

vi.mock('@/components/builder/forms/projects-form', () => ({
  ProjectsForm: () => <div>Projects form</div>,
}));

vi.mock('@/components/builder/forms/additional-form', () => ({
  AdditionalForm: () => <div>Additional form</div>,
}));

vi.mock('@/components/builder/forms/generic-text-form', () => ({
  GenericTextForm: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <button type="button" onClick={() => onChange(`${value} edited`)}>
      Update custom text
    </button>
  ),
}));

vi.mock('@/components/builder/forms/generic-item-form', () => ({
  GenericItemForm: () => <div>Generic item form</div>,
}));

vi.mock('@/components/builder/forms/generic-list-form', () => ({
  GenericListForm: () => <div>Generic list form</div>,
}));

const makeSection = (section: SectionMeta): SectionMeta => section;

const renderResumeHarness = (initialData: ResumeData) => {
  const Harness = () => {
    const [resumeData, setResumeData] = useState(initialData);

    return (
      <div>
        <div data-testid="summary-preview">{resumeData.summary ?? ''}</div>
        <div data-testid="section-preview">
          {resumeData.sectionMeta
            ?.map(
              (section) =>
                `${section.id}:${section.displayName}:${section.order}:${section.isVisible ? 'visible' : 'hidden'}`
            )
            .join('|')}
        </div>
        <div data-testid="custom-preview">
          {Object.keys(resumeData.customSections ?? {}).join(',')}
        </div>
        <ResumeForm resumeData={resumeData} onUpdate={setResumeData} />
      </div>
    );
  };

  return render(<Harness />);
};

const getSectionContainer = (sectionName: string) => {
  const heading = screen.getByRole('heading', { level: 3, name: sectionName });
  return (heading.closest('div.space-y-0') ??
    heading.parentElement?.parentElement?.parentElement) as HTMLElement;
};

describe('builder regression coverage', () => {
  it('keeps the preview in sync when section data changes and a custom section is added', () => {
    renderResumeHarness({
      personalInfo: { name: 'Jane Doe' },
      summary: 'Initial summary',
      sectionMeta: [
        makeSection({
          id: 'personalInfo',
          key: 'personalInfo',
          displayName: 'Personal Info',
          sectionType: 'personalInfo',
          isDefault: true,
          isVisible: true,
          order: 0,
        }),
        makeSection({
          id: 'summary',
          key: 'summary',
          displayName: 'Summary',
          sectionType: 'text',
          isDefault: true,
          isVisible: true,
          order: 1,
        }),
      ],
    });

    expect(screen.getByTestId('summary-preview')).toHaveTextContent('Initial summary');

    fireEvent.click(screen.getByRole('button', { name: 'Update summary' }));

    expect(screen.getByTestId('summary-preview')).toHaveTextContent('Initial summary updated');

    fireEvent.click(screen.getByRole('button', { name: 'Add custom section' }));

    expect(screen.getByRole('heading', { level: 3, name: 'Testimonials' })).toBeInTheDocument();
    expect(screen.getByTestId('custom-preview')).toHaveTextContent('custom_1');
  });

  it('supports rename, reorder, visibility toggle, and delete confirmation for custom sections', () => {
    renderResumeHarness({
      personalInfo: { name: 'Jane Doe' },
      summary: 'Initial summary',
      sectionMeta: [
        makeSection({
          id: 'personalInfo',
          key: 'personalInfo',
          displayName: 'Personal Info',
          sectionType: 'personalInfo',
          isDefault: true,
          isVisible: true,
          order: 0,
        }),
        makeSection({
          id: 'summary',
          key: 'summary',
          displayName: 'Summary',
          sectionType: 'text',
          isDefault: true,
          isVisible: true,
          order: 1,
        }),
        makeSection({
          id: 'custom_1',
          key: 'custom_1',
          displayName: 'Highlights',
          sectionType: 'text',
          isDefault: false,
          isVisible: true,
          order: 2,
        }),
      ],
      customSections: {
        custom_1: {
          sectionType: 'text',
          text: 'Original highlight',
        },
      },
    });

    const customContainer = getSectionContainer('Highlights');

    fireEvent.click(within(customContainer).getByTitle('builder.sectionHeader.renameSection'));

    const renameInput = within(customContainer).getByRole('textbox');
    fireEvent.change(renameInput, { target: { value: 'Portfolio' } });
    fireEvent.keyDown(renameInput, { key: 'Enter', code: 'Enter' });

    expect(screen.getByRole('heading', { level: 3, name: 'Portfolio' })).toBeInTheDocument();
    expect(screen.getByTestId('section-preview')).toHaveTextContent('custom_1:Portfolio:2:visible');

    fireEvent.click(
      within(getSectionContainer('Portfolio')).getByTitle('builder.sectionHeader.moveUp')
    );

    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    ).toEqual(['Portfolio', 'Summary']);
    expect(screen.getByTestId('section-preview')).toHaveTextContent('custom_1:Portfolio:1:visible');

    fireEvent.click(
      within(getSectionContainer('Portfolio')).getByTitle('builder.sectionHeader.hideSection')
    );

    expect(screen.getByTestId('section-preview')).toHaveTextContent('custom_1:Portfolio:1:hidden');
    expect(
      within(getSectionContainer('Portfolio')).getByText('builder.sectionHeader.hiddenFromPdfTag')
    ).toBeInTheDocument();

    fireEvent.click(
      within(getSectionContainer('Portfolio')).getByTitle('builder.sectionHeader.showSection')
    );

    expect(screen.getByTestId('section-preview')).toHaveTextContent('custom_1:Portfolio:1:visible');

    fireEvent.click(
      within(getSectionContainer('Portfolio')).getByTitle('builder.sectionHeader.deleteSection')
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));

    expect(screen.queryByRole('heading', { level: 3, name: 'Portfolio' })).not.toBeInTheDocument();
    expect(screen.getByTestId('custom-preview')).not.toHaveTextContent('custom_1');
  });
});

describe('SectionHeader', () => {
  it('supports inline rename and default-section visibility toggling', () => {
    const rename = vi.fn();
    const toggleVisibility = vi.fn();

    render(
      <SectionHeader
        section={{
          id: 'summary',
          key: 'summary',
          displayName: 'Summary',
          sectionType: 'text',
          isDefault: true,
          isVisible: true,
          order: 1,
        }}
        onRename={rename}
        onDelete={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onToggleVisibility={toggleVisibility}
        isFirst={false}
        isLast={false}
        canDelete={true}
      >
        <div>Section body</div>
      </SectionHeader>
    );

    fireEvent.click(screen.getByTitle('builder.sectionHeader.renameSection'));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Overview' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(rename).toHaveBeenCalledWith('Overview');

    fireEvent.click(screen.getAllByTitle('builder.sectionHeader.hideSection')[0]);

    expect(toggleVisibility).toHaveBeenCalledTimes(1);
  });
});
