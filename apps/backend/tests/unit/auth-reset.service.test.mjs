import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'unit-test-jwt-secret';
process.env.APP_BASE_URL = 'http://localhost:3000';

const { createAuthResetFixture } = await import('../helpers/auth-reset.fixture.mjs');
const authService = await import('../../src/services/auth.service.js');

test('auth reset fixture sends reset email and invalidates tokens after use', async () => {
  const fixture = createAuthResetFixture();

  try {
    fixture.seedUser({
      id: 'user-1',
      email: 'candidate.fixture@example.com',
    });

    const resetRequest = await authService.requestPasswordReset({
      email: 'candidate.fixture@example.com',
    });

    assert.equal(resetRequest.message, 'If the account exists, a reset instruction has been generated');
    assert.ok(resetRequest.reset_token);
    assert.equal(fixture.mailer.sentMessages.length, 1);
    assert.equal(fixture.mailer.sentMessages[0].to, 'candidate.fixture@example.com');
    assert.equal(fixture.mailer.sentMessages[0].subject, 'Reset your password');
    assert.match(fixture.mailer.sentMessages[0].reset_link, /\/reset-password\?token=/);

    const resetToken = new URL(fixture.mailer.sentMessages[0].reset_link).searchParams.get('token');
    assert.equal(resetToken, resetRequest.reset_token);

    const resetResult = await authService.resetPassword({
      token: resetToken,
      new_password: 'ResetPass123',
    });

    assert.equal(resetResult.message, 'Password has been reset successfully');

    await assert.rejects(
      authService.resetPassword({
        token: resetToken,
        new_password: 'ResetPass456',
      }),
      /Invalid or expired reset token/
    );

    const reusedRequest = await authService.requestPasswordReset({
      email: 'candidate.fixture@example.com',
    });

    assert.ok(reusedRequest.reset_token);
    assert.notEqual(reusedRequest.reset_token, resetToken);
    assert.equal(fixture.mailer.sentMessages.length, 2);
    assert.equal(new URL(fixture.mailer.sentMessages[1].reset_link).searchParams.get('token'), reusedRequest.reset_token);
  } finally {
    await fixture.cleanup();
  }
});