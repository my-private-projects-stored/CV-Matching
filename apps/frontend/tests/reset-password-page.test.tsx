import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=reset-token-123'),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/lib/api/auth', () => ({
  resetPassword: vi.fn(),
}));

import ResetPasswordPage from '@/app/(default)/reset-password/page';
import { resetPassword } from '@/lib/api/auth';

const mockedResetPassword = vi.mocked(resetPassword);

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    mockedResetPassword.mockReset();
  });

  it('submits the new password and confirms success', async () => {
    mockedResetPassword.mockResolvedValue({ message: 'Password has been reset successfully' });

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText('auth.newPasswordPlaceholder'), {
      target: { value: 'NewStrongPass123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.confirmPasswordPlaceholder'), {
      target: { value: 'NewStrongPass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'auth.resetPasswordAction' }));

    await waitFor(() => {
      expect(mockedResetPassword).toHaveBeenCalledWith({
        token: 'reset-token-123',
        new_password: 'NewStrongPass123',
      });
    });

    expect(await screen.findByText('Password has been reset successfully')).toBeInTheDocument();
  });
});
