export const MAX_RESUME_UPLOAD_BYTES = 4 * 1024 * 1024;

const ALLOWED_DETECTED_TYPES = new Set(["pdf", "docx", "doc", "txt"]);

function startsWithBytes(buf, bytes) {
  if (!buf || buf.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (buf[i] !== bytes[i]) return false;
  }
  return true;
}

function isPlainUtf8Text(buf) {
  if (!buf || buf.length === 0) return false;
  for (let i = 0; i < buf.length; i += 1) {
    if (buf[i] === 0x00) return false;
  }
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    decoder.decode(buf);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect actual file type from binary magic bytes to prevent extension spoofing.
 */
export function detectFileTypeByMagicBytes(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input || "");
  if (buf.length === 0) {
    return "unknown";
  }

  // Executable / script signatures explicitly blocked
  if (
    startsWithBytes(buf, [0x4d, 0x5a]) || // PE/MZ (.exe, .dll)
    startsWithBytes(buf, [0x7f, 0x45, 0x4c, 0x46]) || // ELF
    startsWithBytes(buf, [0xfe, 0xed, 0xfa, 0xce]) || // Mach-O 32
    startsWithBytes(buf, [0xfe, 0xed, 0xfa, 0xcf]) || // Mach-O 64
    startsWithBytes(buf, [0xcf, 0xfa, 0xed, 0xfe]) || // Mach-O LE 64
    startsWithBytes(buf, [0x23, 0x21]) // Shebang #!
  ) {
    return "blocked_executable";
  }

  // %PDF-
  if (startsWithBytes(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return "pdf";
  }

  // ZIP / OOXML (.docx)
  if (startsWithBytes(buf, [0x50, 0x4b, 0x03, 0x04])) {
    return "docx";
  }

  // OLE2 Compound Binary (.doc)
  if (startsWithBytes(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return "doc";
  }

  if (isPlainUtf8Text(buf)) {
    return "txt";
  }

  return "unknown";
}

/**
 * Validate uploaded resume buffer against size limit (4MB) and binary magic bytes.
 */
export function validateResumeUpload({
  buffer,
  mimeType = "",
  maxBytes = MAX_RESUME_UPLOAD_BYTES,
} = {}) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || "");

  if (buf.length === 0) {
    return {
      ok: false,
      detectedType: "unknown",
      errorCode: "empty_file",
      message: "Uploaded file is empty",
    };
  }

  if (buf.length > maxBytes) {
    return {
      ok: false,
      detectedType: "unknown",
      errorCode: "uploaded_file_too_large",
      message: `File size exceeds maximum allowed ${Math.round(maxBytes / (1024 * 1024))}MB`,
    };
  }

  const detectedType = detectFileTypeByMagicBytes(buf);
  if (detectedType === "blocked_executable" || !ALLOWED_DETECTED_TYPES.has(detectedType)) {
    return {
      ok: false,
      detectedType,
      errorCode: "invalid_file_signature",
      message: "Unsupported or unsafe file signature. Only PDF, DOCX, DOC, or TXT files are allowed.",
    };
  }

  const normalizedMime = String(mimeType || "").trim().toLowerCase();
  if (normalizedMime === "application/pdf" && detectedType !== "pdf") {
    return {
      ok: false,
      detectedType,
      errorCode: "mime_signature_mismatch",
      message: "File content does not match declared application/pdf MIME type",
    };
  }

  return {
    ok: true,
    detectedType,
    errorCode: null,
    message: "OK",
  };
}
