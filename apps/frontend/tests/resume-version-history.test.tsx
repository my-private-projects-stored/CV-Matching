import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

import ResumeVersionHistory from '@/components/builder/resume-version-history';

describe('ResumeVersionHistory', () => {
  it('renders versions and opens the selected version', () => {
    const onSelectVersion = vi.fn();
    const onCompare = vi.fn();

    render(
      <ResumeVersionHistory
        currentResumeId="resume-current"
        onSelectVersion={onSelectVersion}
        onCompare={onCompare}
        versions={[
          {
            resume_id: 'resume-master',
            candidate_id: 'candidate-1',
            filename: 'master.pdf',
            is_master: true,
            parent_id: null,
            processing_status: 'ready',
            created_at: '2026-05-01T10:00:00.000Z',
            updated_at: '2026-05-01T10:00:00.000Z',
          },
          {
            resume_id: 'resume-current',
            candidate_id: 'candidate-1',
            filename: 'tailored.pdf',
            is_master: false,
            parent_id: 'resume-master',
            processing_status: 'ready',
            created_at: '2026-05-03T10:00:00.000Z',
            updated_at: '2026-05-03T10:00:00.000Z',
          },
        ]}
      />
    );

    expect(screen.getByText('resumeViewer.versionHistoryTitle')).toBeInTheDocument();
    expect(screen.getByText('master.pdf')).toBeInTheDocument();
    expect(screen.getByText('tailored.pdf')).toBeInTheDocument();
    expect(screen.getAllByText('resumeViewer.versionHistoryCurrent').length).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'resumeViewer.versionHistoryOpen' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Compare' })[0]);

    expect(onSelectVersion).toHaveBeenCalledWith('resume-master');
    expect(onCompare).toHaveBeenCalledWith('resume-master');
  });

  it('paginates long version lists', () => {
    render(
      <ResumeVersionHistory
        currentResumeId="resume-9"
        versions={Array.from({ length: 9 }, (_, index) => ({
          resume_id: `resume-${index + 1}`,
          candidate_id: 'candidate-1',
          filename: `resume-${index + 1}.pdf`,
          is_master: index === 8,
          parent_id: index === 0 ? null : `resume-${index}`,
          processing_status: 'ready',
          created_at: `2026-05-0${(index % 9) + 1}T10:00:00.000Z`,
          updated_at: `2026-05-0${(index % 9) + 1}T10:00:00.000Z`,
        }))}
      />
    );

    expect(screen.getByText('resume-1.pdf')).toBeInTheDocument();
    expect(screen.queryByText('resume-9.pdf')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('resume-9.pdf')).toBeInTheDocument();
  });
});
