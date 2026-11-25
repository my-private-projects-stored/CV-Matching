/**
 * Standardized 4-role RBAC constants and transitional alias helpers.
 * Keeps "admin" as a backward-compatible alias for "tech_staff".
 */
export const ROLES = Object.freeze({
  CANDIDATE: "candidate",
  RECRUITER: "recruiter",
  TECH_STAFF: "tech_staff",
  PLATFORM_OWNER: "platform_owner",
  ADMIN_ALIAS: "admin",
});

export const VALID_ROLES = new Set([
  ROLES.CANDIDATE,
  ROLES.RECRUITER,
  ROLES.TECH_STAFF,
  ROLES.PLATFORM_OWNER,
  ROLES.ADMIN_ALIAS,
]);

export const SELF_SIGNUP_ROLES = new Set([ROLES.CANDIDATE, ROLES.RECRUITER]);

/**
 * Normalize role string to its canonical role name.
 * Maps transitional alias "admin" -> "tech_staff". Returns null for unknown roles.
 */
export function canonicalizeRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  if (!normalized || !VALID_ROLES.has(normalized)) {
    return null;
  }
  if (normalized === ROLES.ADMIN_ALIAS) {
    return ROLES.TECH_STAFF;
  }
  return normalized;
}

/**
 * Expand a role into all accepted aliases for RBAC checks.
 */
export function expandRoleAliases(role) {
  const canonical = canonicalizeRole(role);
  if (!canonical) {
    return [];
  }
  if (canonical === ROLES.TECH_STAFF) {
    return [ROLES.TECH_STAFF, ROLES.ADMIN_ALIAS];
  }
  return [canonical];
}

/**
 * Check whether userRole matches any of allowedRoles, treating "admin" and "tech_staff" as equivalent.
 */
export function hasAnyRole(userRole, allowedRoles = []) {
  const userCanonical = canonicalizeRole(userRole);
  if (!userCanonical) {
    return false;
  }

  for (const allowed of allowedRoles) {
    if (canonicalizeRole(allowed) === userCanonical) {
      return true;
    }
  }
  return false;
}
