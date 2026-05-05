const noopMailer = {
  async sendPasswordResetEmail(_message) {
    return { delivered: false };
  },
};

let activeMailer = noopMailer;

export function setMailer(mailer) {
  activeMailer = mailer && typeof mailer.sendPasswordResetEmail === 'function' ? mailer : noopMailer;
}

export function resetMailer() {
  activeMailer = noopMailer;
}

export function getMailer() {
  return activeMailer;
}

export async function sendPasswordResetEmail(message) {
  return activeMailer.sendPasswordResetEmail(message);
}

export function createMockMailer() {
  const sentMessages = [];

  return {
    sentMessages,
    async sendPasswordResetEmail(message) {
      sentMessages.push(message);
      return { delivered: true, message };
    },
  };
}