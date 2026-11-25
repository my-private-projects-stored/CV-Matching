import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_RESUME_UPLOAD_BYTES,
  detectFileTypeByMagicBytes,
  validateResumeUpload,
} from "../src/security/file-magic.js";

test("detectFileTypeByMagicBytes identifies PDF, DOCX, DOC, TXT and blocks executables", () => {
  assert.equal(detectFileTypeByMagicBytes(Buffer.from("%PDF-1.7\n...")), "pdf");
  assert.equal(detectFileTypeByMagicBytes(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14])), "docx");
  assert.equal(
    detectFileTypeByMagicBytes(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
    "doc"
  );
  assert.equal(detectFileTypeByMagicBytes(Buffer.from("Nguyen Tan Loc - Backend CV")), "txt");
  assert.equal(detectFileTypeByMagicBytes(Buffer.from("MZ\x90\x00exe-spoof")), "blocked_executable");
  assert.equal(detectFileTypeByMagicBytes(Buffer.from([0x7f, 0x45, 0x4c, 0x46])), "blocked_executable");
});

test("validateResumeUpload enforces 4MB limit, magic bytes, and MIME consistency", () => {
  const validPdf = validateResumeUpload({
    buffer: Buffer.from("%PDF-1.5\nhello"),
    mimeType: "application/pdf",
  });
  assert.equal(validPdf.ok, true);
  assert.equal(validPdf.detectedType, "pdf");

  const spoofedExe = validateResumeUpload({
    buffer: Buffer.from("MZ\x90\x00fake-pdf"),
    mimeType: "application/pdf",
  });
  assert.equal(spoofedExe.ok, false);
  assert.equal(spoofedExe.errorCode, "invalid_file_signature");

  const mimeMismatch = validateResumeUpload({
    buffer: Buffer.from("Plain text pretending to be PDF"),
    mimeType: "application/pdf",
  });
  assert.equal(mimeMismatch.ok, false);
  assert.equal(mimeMismatch.errorCode, "mime_signature_mismatch");

  const tooLarge = validateResumeUpload({
    buffer: Buffer.alloc(MAX_RESUME_UPLOAD_BYTES + 1, 0x41),
    mimeType: "text/plain",
  });
  assert.equal(tooLarge.ok, false);
  assert.equal(tooLarge.errorCode, "uploaded_file_too_large");
});
