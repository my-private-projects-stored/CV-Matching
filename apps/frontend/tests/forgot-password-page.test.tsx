import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/lib/api/auth', () => ({
  forgotPassword: vi.fn(),
}));

import ForgotPasswordPage from '@/app/(default)/forgot-password/page';
import { forgotPassword } from '@/lib/api/auth';

const mockedForgotPassword = vi.mocked(forgotPassword);

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    mockedForgotPassword.mockReset();
  });

  it('submits the email and shows reset guidance', async () => {
    mockedForgotPassword.mockResolvedValue({
      message: 'If the account exists, a reset instruction has been generated',
      reset_token: 'reset-token-123',
    });

    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText('auth.emailPlaceholder'), {
      target: { value: 'candidate@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'auth.forgotPasswordAction' }));

    await waitFor(() => {
      expect(mockedForgotPassword).toHaveBeenCalledWith('candidate@example.com');
    });

    expect(
      await screen.findByText('If the account exists, a reset instruction has been generated')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'auth.resetPasswordAction' })).toHaveAttribute(
      'href',
      '/reset-password?token=reset-token-123'
    );
  });
});
