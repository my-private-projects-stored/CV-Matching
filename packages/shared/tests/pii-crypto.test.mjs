import test from "node:test";
import assert from "node:assert/strict";

import { decryptPII, encryptPII, isEncryptedPII } from "../src/security/pii-crypto.js";

const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

test("encryptPII and decryptPII perform AES-256-GCM round-trip", () => {
  const plain = "+84 909 123 456 - Thủ Dầu Một, Bình Dương";
  const cipher = encryptPII(plain, TEST_KEY);
  assert.equal(isEncryptedPII(cipher), true);
  assert.notEqual(cipher, plain);
  assert.equal(decryptPII(cipher, TEST_KEY), plain);

  // Random IV ensures distinct ciphertexts for identical plaintexts
  const cipher2 = encryptPII(plain, TEST_KEY);
  assert.notEqual(cipher2, cipher);
  assert.equal(decryptPII(cipher2, TEST_KEY), plain);
});

test("encryptPII avoids double-encrypting and handles empty values", () => {
  assert.equal(encryptPII("", TEST_KEY), "");
  assert.equal(encryptPII(null, TEST_KEY), null);
  assert.equal(decryptPII(undefined, TEST_KEY), undefined);

  const encrypted = encryptPII("0901234567", TEST_KEY);
  assert.equal(encryptPII(encrypted, TEST_KEY), encrypted);
});

test("decryptPII rejects tampered ciphertext and invalid key length", () => {
  const encrypted = encryptPII("sensitive-pii", TEST_KEY);
  const parts = encrypted.split(":");
  parts[4] = "AAAA" + parts[4].slice(4);
  assert.throws(() => decryptPII(parts.join(":"), TEST_KEY));
  assert.throws(() => encryptPII("test", "short-key"), /64-character hex/);
});
