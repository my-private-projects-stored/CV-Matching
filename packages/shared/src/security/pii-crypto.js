import crypto from "node:crypto";

const PREFIX = "enc:v1:";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function parseKey(keyHex) {
  const normalized = String(keyHex || "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("PII encryption key must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(normalized, "hex");
}

/**
 * Check whether a value is already encrypted with the enc:v1 AES-256-GCM envelope.
 */
export function isEncryptedPII(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/**
 * Encrypt sensitive PII text using AES-256-GCM.
 * Returns null/undefined/"" unchanged and avoids double-encrypting existing envelopes.
 */
export function encryptPII(plaintext, keyHex) {
  if (plaintext === null || plaintext === undefined || plaintext === "") {
    return plaintext;
  }

  const text = String(plaintext);
  if (isEncryptedPII(text)) {
    return text;
  }

  const key = parseKey(keyHex);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Decrypt an AES-256-GCM enc:v1 envelope back to UTF-8 plaintext.
 */
export function decryptPII(ciphertext, keyHex) {
  if (ciphertext === null || ciphertext === undefined || ciphertext === "") {
    return ciphertext;
  }

  const text = String(ciphertext);
  if (!isEncryptedPII(text)) {
    return text;
  }

  const parts = text.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted PII format");
  }

  const key = parseKey(keyHex);
  const iv = Buffer.from(parts[0], "base64");
  const tag = Buffer.from(parts[1], "base64");
  const encrypted = Buffer.from(parts[2], "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
