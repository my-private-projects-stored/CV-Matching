import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'candidate-1', role: 'candidate' },
    isLoading: false,
  }),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/lib/api/candidate-profile', () => ({
  fetchMyCandidateProfile: vi.fn(),
  updateMyCandidateProfile: vi.fn(),
}));

import ProfilePage from '@/app/(default)/profile/page';
import { fetchMyCandidateProfile, updateMyCandidateProfile } from '@/lib/api/candidate-profile';

const mockedFetchMyCandidateProfile = vi.mocked(fetchMyCandidateProfile);
const mockedUpdateMyCandidateProfile = vi.mocked(updateMyCandidateProfile);

describe('ProfilePage', () => {
  beforeEach(() => {
    mockedFetchMyCandidateProfile.mockReset();
    mockedUpdateMyCandidateProfile.mockReset();
  });

  it('loads profile data and saves updates', async () => {
    mockedFetchMyCandidateProfile.mockResolvedValue({
      data: {
        user_id: 'candidate-1',
        email: 'candidate@example.com',
        full_name: 'Candidate',
        role: 'candidate',
        profile: {
          headline: 'Frontend Engineer',
          summary: 'Build scalable UI systems for enterprise apps.',
          phone: '555-0101',
          location: 'Hanoi',
          website: 'https://example.com',
          portfolio_links: ['https://portfolio.example'],
          skills: ['React', 'TypeScript'],
          experience: [],
          education: [],
          portfolio: [],
        },
        updated_at: '2026-03-23T00:00:00.000Z',
      },
    });

    mockedUpdateMyCandidateProfile.mockResolvedValue({
      data: {
        user_id: 'candidate-1',
        email: 'candidate@example.com',
        full_name: 'Candidate',
        role: 'candidate',
        profile: {
          headline: 'Senior Frontend Engineer',
          summary: 'Build scalable UI systems for enterprise apps.',
          phone: '555-0101',
          location: 'Hanoi',
          website: 'https://example.com',
          portfolio_links: ['https://portfolio.example', 'github.com/candidate'],
          skills: ['React', 'TypeScript', 'Node.js'],
          experience: [
            {
              title: 'Senior Engineer',
              company: 'Example Co',
              location: 'Remote',
              start_date: '2022-01',
              end_date: '2024-01',
              summary: 'Led UI work.',
            },
          ],
          education: [
            {
              school: 'State University',
              degree: 'BSc',
              field: 'Computer Science',
              start_date: '2018',
              end_date: '2022',
              summary: 'Focused on systems.',
            },
          ],
          portfolio: [
            {
              name: 'Design System',
              url: 'https://portfolio.example',
              description: 'Component library showcase.',
            },
          ],
        },
        updated_at: '2026-03-23T01:00:00.000Z',
      },
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(mockedFetchMyCandidateProfile).toHaveBeenCalled();
    });

    const headlineInput = screen.getByPlaceholderText(
      'profile.headlinePlaceholder'
    ) as HTMLInputElement;

    expect(headlineInput.value).toBe('Frontend Engineer');

    fireEvent.change(headlineInput, { target: { value: 'Senior Frontend Engineer' } });
    fireEvent.change(screen.getByPlaceholderText('profile.skillsPlaceholder'), {
      target: { value: 'React, TypeScript, Node.js' },
    });
    fireEvent.change(screen.getByPlaceholderText('profile.portfolioLinksPlaceholder'), {
      target: { value: 'https://portfolio.example, github.com/candidate' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'profile.addExperienceAction' }));
    fireEvent.change(screen.getByPlaceholderText('profile.experienceTitlePlaceholder'), {
      target: { value: 'Senior Engineer' },
    });
    fireEvent.change(screen.getByPlaceholderText('profile.experienceCompanyPlaceholder'), {
      target: { value: 'Example Co' },
    });
    fireEvent.change(screen.getByPlaceholderText('profile.experienceLocationPlaceholder'), {
      target: { value: 'Remote' },
    });
    fireEvent.change(screen.getByPlaceholderText('profile.experienceStartDatePlaceholder'), {
      target: { value: '2022-01' },
    });
    fireEvent.change(screen.getByPlaceholderText('profile.experienceEndDatePlaceholder'), {
      target: { value: '2024-01' },
    });
    fireEvent.change(screen.getByPlaceholderText('profile.experienceSummaryPlaceholder'), {
      target: { value: 'Led UI work.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'profile.addEducationAction' }));
    fireEvent.change(screen.getByPlaceholderText('profile.educationSchoolPlaceholder'), {
      target: { value: 'State University' },
    });
    fireEvent.change(screen.getByPlaceholderText('profile.educationDegreePlaceholder'), {
      target: { value: 'BSc' },
    });
    fireEvent.change(screen.getByPlaceholderText('profile.educationFieldPlaceholder'), {
      target: { value: 'Computer Science' },
    });
    fireEvent.change(screen.getByPlaceholderText('profile.educationStartDatePlaceholder'), {
      target: { value: '2018' },
    });
    fireEvent.change(screen.getByPlaceholderText('profile.educationEndDatePlaceholder'), {
      target: { value: '2022' },
    });
    fireEvent.change(screen.getByPlaceholderText('profile.educationSummaryPlaceholder'), {
      target: { value: 'Focused on systems.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'profile.addPortfolioAction' }));
    fireEvent.change(screen.getByPlaceholderText('profile.portfolioNamePlaceholder'), {
      target: { value: 'Design System' },
    });
    fireEvent.change(screen.getByPlaceholderText('profile.portfolioUrlPlaceholder'), {
      target: { value: 'https://portfolio.example' },
    });
    fireEvent.change(screen.getByPlaceholderText('profile.portfolioDescriptionPlaceholder'), {
      target: { value: 'Component library showcase.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'profile.saveAction' }));

    await waitFor(() => {
      expect(mockedUpdateMyCandidateProfile).toHaveBeenCalledWith({
        headline: 'Senior Frontend Engineer',
        summary: 'Build scalable UI systems for enterprise apps.',
        phone: '555-0101',
        location: 'Hanoi',
        website: 'https://example.com',
        skills: ['React', 'TypeScript', 'Node.js'],
        portfolio_links: ['https://portfolio.example', 'github.com/candidate'],
        experience: [
          {
            title: 'Senior Engineer',
            company: 'Example Co',
            location: 'Remote',
            start_date: '2022-01',
            end_date: '2024-01',
            summary: 'Led UI work.',
          },
        ],
        education: [
          {
            school: 'State University',
            degree: 'BSc',
            field: 'Computer Science',
            start_date: '2018',
            end_date: '2022',
            summary: 'Focused on systems.',
          },
        ],
        portfolio: [
          {
            name: 'Design System',
            url: 'https://portfolio.example',
            description: 'Component library showcase.',
          },
        ],
      });
    });

    await waitFor(() => {
      expect(screen.getByText('profile.saveSuccess')).toBeInTheDocument();
    });
  });

  it('shows validation errors and prevents save when headline missing or summary too short', async () => {
    mockedFetchMyCandidateProfile.mockResolvedValue({
      data: {
        user_id: 'candidate-1',
        profile: {
          headline: '',
          summary: '',
          phone: '',
          location: '',
          website: '',
          portfolio_links: [],
          skills: [],
          experience: [],
          education: [],
          portfolio: [],
        },
      },
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(mockedFetchMyCandidateProfile).toHaveBeenCalled();
    });

    // Attempt to save with empty headline
    fireEvent.click(screen.getByRole('button', { name: 'profile.saveAction' }));

    await waitFor(() => {
      expect(mockedUpdateMyCandidateProfile).not.toHaveBeenCalled();
      expect(screen.getByText('profile.errors.headlineRequired')).toBeInTheDocument();
    });

    // Fill headline but short summary
    fireEvent.change(screen.getByPlaceholderText('profile.headlinePlaceholder'), {
      target: { value: 'Short Headline' },
    });
    fireEvent.change(screen.getByPlaceholderText('profile.summaryPlaceholder'), {
      target: { value: 'too short' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'profile.saveAction' }));

    await waitFor(() => {
      expect(mockedUpdateMyCandidateProfile).not.toHaveBeenCalled();
      expect(screen.getByText('profile.errors.summaryTooShort')).toBeInTheDocument();
    });
  });
});
