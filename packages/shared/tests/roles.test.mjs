import test from "node:test";
import assert from "node:assert/strict";

import {
  ROLES,
  SELF_SIGNUP_ROLES,
  canonicalizeRole,
  expandRoleAliases,
  hasAnyRole,
} from "../src/auth/roles.js";

test("canonicalizeRole maps admin alias to tech_staff and validates roles", () => {
  assert.equal(canonicalizeRole("candidate"), ROLES.CANDIDATE);
  assert.equal(canonicalizeRole(" RECRUITER "), ROLES.RECRUITER);
  assert.equal(canonicalizeRole("tech_staff"), ROLES.TECH_STAFF);
  assert.equal(canonicalizeRole("admin"), ROLES.TECH_STAFF);
  assert.equal(canonicalizeRole("platform_owner"), ROLES.PLATFORM_OWNER);
  assert.equal(canonicalizeRole("superuser"), null);
  assert.equal(canonicalizeRole(""), null);
});

test("expandRoleAliases returns both tech_staff and admin for either role", () => {
  assert.deepEqual(expandRoleAliases("admin"), ["tech_staff", "admin"]);
  assert.deepEqual(expandRoleAliases("tech_staff"), ["tech_staff", "admin"]);
  assert.deepEqual(expandRoleAliases("platform_owner"), ["platform_owner"]);
  assert.deepEqual(expandRoleAliases("invalid"), []);
});

test("hasAnyRole treats admin and tech_staff as equivalent aliases", () => {
  assert.equal(hasAnyRole("admin", ["tech_staff"]), true);
  assert.equal(hasAnyRole("tech_staff", ["admin"]), true);
  assert.equal(hasAnyRole("platform_owner", ["platform_owner"]), true);
  assert.equal(hasAnyRole("candidate", ["recruiter", "tech_staff"]), false);
  assert.equal(hasAnyRole(null, ["candidate"]), false);
  assert.equal(SELF_SIGNUP_ROLES.has("candidate"), true);
  assert.equal(SELF_SIGNUP_ROLES.has("platform_owner"), false);
});
