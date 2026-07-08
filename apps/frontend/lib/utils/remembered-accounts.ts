const REMEMBERED_EMAILS_KEY = 'cvm_remembered_emails';

export function getRememberedEmails(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(REMEMBERED_EMAILS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveRememberedEmail(email: string) {
  if (typeof window === 'undefined' || !email) return;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return;
  try {
    const emails = getRememberedEmails();
    const updated = [trimmed, ...emails.filter((e) => e !== trimmed)].slice(0, 5);
    localStorage.setItem(REMEMBERED_EMAILS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function removeRememberedEmail(email: string): string[] {
  if (typeof window === 'undefined') return [];
  const trimmed = email.trim().toLowerCase();
  try {
    const emails = getRememberedEmails();
    const updated = emails.filter((e) => e !== trimmed);
    localStorage.setItem(REMEMBERED_EMAILS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}
