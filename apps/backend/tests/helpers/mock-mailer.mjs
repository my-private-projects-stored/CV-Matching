import { createMockMailer, resetMailer, setMailer } from '../../src/services/mailer.service.js';

export function installMockMailer() {
  const mockMailer = createMockMailer();
  setMailer(mockMailer);

  return {
    mockMailer,
    reset() {
      resetMailer();
    },
  };
}