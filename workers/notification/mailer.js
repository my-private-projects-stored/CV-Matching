import nodemailer from "nodemailer";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_SECURE = process.env.SMTP_SECURE === "true"; // true for port 465 (SSL)
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
export const SMTP_FROM =
  process.env.SMTP_FROM || `"CV Matching Platform" <noreply@cv-matching.local>`;

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

let _transport = null;

/**
 * Returns true if SMTP is configured (SMTP_HOST is set).
 * If false, all send() calls will be no-ops.
 */
export function isConfigured() {
  return Boolean(SMTP_HOST);
}

function getTransport() {
  if (_transport) return _transport;

  if (!isConfigured()) {
    return null;
  }

  _transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER
      ? {
          user: SMTP_USER,
          pass: SMTP_PASS,
        }
      : undefined,
    // Gracefully handle self-signed certs in dev
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });

  return _transport;
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

/**
 * Send an email. Returns { delivered: true } on success, { delivered: false } otherwise.
 * Never throws — errors are logged and swallowed.
 *
 * @param {{ to: string, subject: string, html: string, text?: string }} message
 */
export async function sendEmail({ to, subject, html, text }) {
  const transport = getTransport();

  if (!transport) {
    console.warn("[worker-notification] SMTP not configured — email skipped", {
      to,
      subject,
    });
    return { delivered: false, reason: "smtp_not_configured" };
  }

  if (!to || !subject || !html) {
    console.warn("[worker-notification] sendEmail called with missing fields", {
      to,
      subject,
      hasHtml: Boolean(html),
    });
    return { delivered: false, reason: "missing_fields" };
  }

  try {
    const info = await transport.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
      text: text || stripHtml(html),
    });

    console.log("[worker-notification] email sent", {
      to,
      subject,
      messageId: info.messageId,
    });

    return { delivered: true, messageId: info.messageId };
  } catch (error) {
    console.error("[worker-notification] email send failed", {
      to,
      subject,
      error: error.message,
    });
    return { delivered: false, reason: "smtp_error", error: error.message };
  }
}

/**
 * Verify SMTP connection. Useful for startup health checks.
 */
export async function verifySmtpConnection() {
  const transport = getTransport();
  if (!transport) {
    return { ok: false, reason: "smtp_not_configured" };
  }

  try {
    await transport.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(html) {
  return String(html || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
