import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  REDIS_KEYS,
  ROLES,
  SELF_SIGNUP_ROLES,
  VALID_ROLES,
  canonicalizeRole,
  createHttpError,
  decryptPII,
  encryptPII,
  hasAnyRole,
} from "@cvm/shared";

const DEFAULT_ACCESS_EXPIRES = "15m";
const DEFAULT_REFRESH_EXPIRES = "7d";
const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 7 * 86400;

function sanitizeUser(userDoc) {
  if (!userDoc) return null;
  if (typeof userDoc.toSafeObject === "function") {
    return userDoc.toSafeObject();
  }
  return {
    id: String(userDoc._id),
    name: userDoc.name,
    full_name: userDoc.name,
    email: userDoc.email,
    role: canonicalizeRole(userDoc.role) || userDoc.role,
    rawRole: userDoc.role,
    avatar: null,
    disabled: Boolean(userDoc.disabled),
    disabledReason: userDoc.disabledReason || "",
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt,
    created_at: userDoc.createdAt,
    updated_at: userDoc.updatedAt,
  };
}

function hashResetToken(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken || "")).digest("hex");
}

function encryptProfileFields(profile = {}, piiEncryptionKey) {
  const next = { ...profile };
  if (next.phone !== undefined) {
    next.phone = next.phone ? encryptPII(String(next.phone).trim(), piiEncryptionKey) : "";
  }
  if (next.location !== undefined) {
    next.location = next.location ? encryptPII(String(next.location).trim(), piiEncryptionKey) : "";
  }
  return next;
}

function decryptProfileFields(profile = {}, piiEncryptionKey) {
  const summary = profile.summary || profile.bio || "";
  const website = profile.website || profile.portfolioUrl || "";
  const portfolioLinks = Array.isArray(profile.portfolio_links)
    ? profile.portfolio_links
    : profile.portfolioUrl
      ? [profile.portfolioUrl]
      : [];
  const educationItems = Array.isArray(profile.educationItems)
    ? profile.educationItems
    : Array.isArray(profile.education)
      ? profile.education
      : [];

  return {
    phone: profile.phone ? decryptPII(profile.phone, piiEncryptionKey) : "",
    location: profile.location ? decryptPII(profile.location, piiEncryptionKey) : "",
    headline: profile.headline || "",
    bio: summary,
    summary,
    website,
    portfolio_links: portfolioLinks,
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    experienceYears: Number(profile.experienceYears || 0),
    education: educationItems,
    experience: Array.isArray(profile.experience) ? profile.experience : [],
    portfolio: Array.isArray(profile.portfolio) ? profile.portfolio : [],
    linkedinUrl: profile.linkedinUrl || "",
    githubUrl: profile.githubUrl || "",
    portfolioUrl: website,
  };
}

/**
 * Auth, User Governance, and Encrypted Candidate Profile service.
 */
export function createAuthService({
  UserModel,
  AuditLogModel,
  redisClient = null,
  redisBus = null,
  jwtSecret = process.env.JWT_SECRET || "dev-secret",
  jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "dev-refresh-secret",
  accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || DEFAULT_ACCESS_EXPIRES,
  refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || DEFAULT_REFRESH_EXPIRES,
  piiEncryptionKey = process.env.PII_ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  canRecruiterReadCandidateProfile = async () => false,
} = {}) {
  function signTokenPair(user) {
    const userId = String(user._id);
    const role = canonicalizeRole(user.role) || user.role;
    const accessJti = crypto.randomUUID();
    const refreshJti = crypto.randomUUID();

    const accessToken = jwt.sign(
      { id: userId, role, email: user.email, jti: accessJti },
      jwtSecret,
      { expiresIn: accessExpiresIn }
    );

    const refreshToken = jwt.sign(
      { id: userId, role, type: "refresh", jti: refreshJti },
      jwtRefreshSecret,
      { expiresIn: refreshExpiresIn }
    );

    return { accessToken, refreshToken, accessJti, refreshJti };
  }

  async function signup({ name, full_name, fullName, email, password, role = ROLES.CANDIDATE }) {
    const cleanName = String(name || full_name || fullName || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "");
    const normalizedRole = canonicalizeRole(role) || String(role || "").trim().toLowerCase();

    if (!cleanName || !cleanEmail || cleanPassword.length < 6) {
      throw createHttpError(
        400,
        "Name, valid email, and password (min 6 characters) are required",
        "invalid_signup_payload"
      );
    }

    if (!SELF_SIGNUP_ROLES.has(normalizedRole)) {
      throw createHttpError(
        403,
        "Self-signup is only allowed for candidate or recruiter roles",
        "forbidden_signup_role"
      );
    }

    const existing = await UserModel.findOne({ email: cleanEmail });
    if (existing) {
      throw createHttpError(409, "Email already registered", "email_already_exists");
    }

    const passwordHash = await bcrypt.hash(cleanPassword, 10);
    const created = await UserModel.create({
      name: cleanName,
      email: cleanEmail,
      password: passwordHash,
      role: normalizedRole,
    });

    const tokens = signTokenPair(created);
    created.refreshTokenJti = tokens.refreshJti;
    await created.save();

    return {
      token: tokens.accessToken,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: sanitizeUser(created),
    };
  }

  async function login({ email, password }) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "");

    if (!cleanEmail || !cleanPassword) {
      throw createHttpError(400, "Email and password are required", "invalid_credentials");
    }

    if (redisBus && (await redisBus.isLoginLocked(cleanEmail, 5))) {
      throw createHttpError(
        429,
        "Account temporarily locked due to too many failed login attempts. Try again in 15 minutes.",
        "account_locked_temporarily"
      );
    }

    const user = await UserModel.findOne({ email: cleanEmail });
    if (!user) {
      if (redisBus) {
        const lockState = await redisBus.recordFailedLogin(cleanEmail, { maxAttempts: 5, lockSeconds: 900 });
        if (lockState.locked) {
          throw createHttpError(
            429,
            "Account temporarily locked due to too many failed login attempts.",
            "account_locked_temporarily"
          );
        }
      }
      throw createHttpError(401, "Invalid email or password", "invalid_credentials");
    }

    if (user.disabled) {
      throw createHttpError(
        403,
        user.disabledReason ? `Account disabled: ${user.disabledReason}` : "Account is disabled",
        "account_disabled"
      );
    }

    const matched = await bcrypt.compare(cleanPassword, user.password);
    if (!matched) {
      if (redisBus) {
        const lockState = await redisBus.recordFailedLogin(cleanEmail, { maxAttempts: 5, lockSeconds: 900 });
        if (lockState.locked) {
          throw createHttpError(
            429,
            "Account temporarily locked due to too many failed login attempts.",
            "account_locked_temporarily"
          );
        }
      }
      throw createHttpError(401, "Invalid email or password", "invalid_credentials");
    }

    if (redisBus) {
      await redisBus.clearFailedLogin(cleanEmail);
    }
    if (redisClient && typeof redisClient.del === "function") {
      await redisClient.del(REDIS_KEYS.userBlacklist(String(user._id)));
    }

    const tokens = signTokenPair(user);
    user.refreshTokenJti = tokens.refreshJti;
    await user.save();

    return {
      token: tokens.accessToken,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: sanitizeUser(user),
    };
  }

  async function refresh({ refreshToken }) {
    if (!refreshToken) {
      throw createHttpError(401, "Refresh token is required", "refresh_token_missing");
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, jwtRefreshSecret);
    } catch {
      throw createHttpError(401, "Invalid or expired refresh token", "invalid_refresh_token");
    }

    const userId = String(decoded?.id || "");
    const jti = String(decoded?.jti || "");

    const user = await UserModel.findById(userId);
    if (!user || user.disabled) {
      throw createHttpError(401, "User unavailable or disabled", "account_disabled");
    }

    if (!user.refreshTokenJti || user.refreshTokenJti !== jti) {
      if (redisBus) {
        await redisBus.blacklistUser(userId, REFRESH_TTL_SECONDS);
      }
      user.refreshTokenJti = null;
      await user.save();
      throw createHttpError(401, "Refresh token reuse detected", "refresh_token_reused");
    }

    if (redisBus && (await redisBus.isBlacklisted({ jti, userId }))) {
      throw createHttpError(401, "Refresh token has been revoked", "token_revoked");
    }

    if (redisBus && jti) {
      await redisBus.blacklistToken(jti, REFRESH_TTL_SECONDS);
    }

    const tokens = signTokenPair(user);
    user.refreshTokenJti = tokens.refreshJti;
    await user.save();

    return {
      token: tokens.accessToken,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: sanitizeUser(user),
    };
  }

  async function logout({ accessJti, refreshToken, userId }) {
    if (redisBus && accessJti) {
      await redisBus.blacklistToken(accessJti, ACCESS_TTL_SECONDS);
    }

    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, jwtRefreshSecret);
        if (redisBus && decoded?.jti) {
          await redisBus.blacklistToken(String(decoded.jti), REFRESH_TTL_SECONDS);
        }
      } catch {
        // Ignore expired/invalid refresh cookie on logout
      }
    }

    if (userId) {
      const user = await UserModel.findById(userId);
      if (user) {
        user.refreshTokenJti = null;
        await user.save();
      }
    }

    return { ok: true };
  }

  async function changePassword({ userId, currentPassword, newPassword }) {
    if (!newPassword || String(newPassword).length < 6) {
      throw createHttpError(400, "New password must be at least 6 characters", "invalid_password");
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw createHttpError(404, "User not found", "user_not_found");
    }

    const matched = await bcrypt.compare(String(currentPassword || ""), user.password);
    if (!matched) {
      throw createHttpError(401, "Current password is incorrect", "invalid_credentials");
    }

    user.password = await bcrypt.hash(String(newPassword), 10);
    user.refreshTokenJti = null;
    await user.save();

    if (redisBus) {
      await redisBus.blacklistUser(String(user._id), REFRESH_TTL_SECONDS);
    }

    return { ok: true, message: "Password changed successfully" };
  }

  async function forgotPassword({ email }) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const message = "If an account with that email exists, a password reset link has been sent.";
    const user = await UserModel.findOne({ email: cleanEmail });
    if (!user) {
      return { ok: true, message };
    }

    const rawToken = crypto.randomBytes(24).toString("hex");
    user.resetPasswordTokenHash = hashResetToken(rawToken);
    user.resetPasswordExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    const exposeResetToken =
      process.env.NODE_ENV !== "production" || process.env.EXPOSE_RESET_TOKEN === "true";

    return {
      ok: true,
      message,
      ...(exposeResetToken ? { resetToken: rawToken, reset_token: rawToken } : {}),
    };
  }

  async function resetPassword({ token, newPassword }) {
    if (!token || !newPassword || String(newPassword).length < 6) {
      throw createHttpError(400, "Valid reset token and password (min 6 chars) required", "invalid_reset_payload");
    }

    const tokenHash = hashResetToken(token);
    const user = await UserModel.findOne({ resetPasswordTokenHash: tokenHash });
    if (!user || !user.resetPasswordExpiresAt || new Date(user.resetPasswordExpiresAt) < new Date()) {
      throw createHttpError(400, "Reset token is invalid or expired", "invalid_reset_token");
    }

    user.password = await bcrypt.hash(String(newPassword), 10);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;
    user.refreshTokenJti = null;
    await user.save();

    if (redisBus) {
      await redisBus.blacklistUser(String(user._id), REFRESH_TTL_SECONDS);
    }

    return { ok: true, message: "Password reset successfully" };
  }

  async function getMe({ userId }) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw createHttpError(404, "User not found", "user_not_found");
    }
    return sanitizeUser(user);
  }

  async function updateMe({ userId, name }) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw createHttpError(404, "User not found", "user_not_found");
    }
    if (name !== undefined && String(name).trim()) {
      user.name = String(name).trim();
    }
    await user.save();
    return sanitizeUser(user);
  }

  async function listUsers({ role = null, disabled = null, search = "", page = 1, limit = 20 } = {}) {
    const filter = {};
    if (role) {
      const canonical = canonicalizeRole(role);
      filter.role = canonical === ROLES.TECH_STAFF ? { $in: [ROLES.TECH_STAFF, ROLES.ADMIN_ALIAS] } : canonical || role;
    }
    if (disabled !== null && disabled !== undefined && disabled !== "") {
      filter.disabled = String(disabled) === "true" || disabled === true;
    }
    if (search && String(search).trim()) {
      const rx = new RegExp(String(search).trim(), "i");
      filter.$or = [{ name: rx }, { email: rx }];
    }

    const safeLimit = Math.min(100, Math.max(1, Number.parseInt(String(limit), 10) || 20));
    const safePage = Math.max(1, Number.parseInt(String(page), 10) || 1);
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
      UserModel.find(filter, null, { sort: { createdAt: -1 }, skip, limit: safeLimit }),
      UserModel.countDocuments(filter),
    ]);

    return {
      users: items.map(sanitizeUser),
      pagination: { page: safePage, limit: safeLimit, total },
    };
  }

  async function suspendUser({ actorId, actorRole, targetUserId, reason, requestId = "" }) {
    const cleanReason = String(reason || "").trim();
    if (!cleanReason) {
      throw createHttpError(400, "Suspension reason is required", "reason_required");
    }

    const user = await UserModel.findById(targetUserId);
    if (!user) {
      throw createHttpError(404, "User not found", "user_not_found");
    }

    const before = { disabled: Boolean(user.disabled), disabledReason: user.disabledReason || "" };
    user.disabled = true;
    user.disabledReason = cleanReason;
    user.refreshTokenJti = null;
    await user.save();

    if (redisBus) {
      await redisBus.blacklistUser(String(user._id), REFRESH_TTL_SECONDS);
    }

    const audit = await AuditLogModel.create({
      actorId: String(actorId),
      actorRole: canonicalizeRole(actorRole) || String(actorRole),
      action: "SUSPEND_USER",
      targetUserId: String(user._id),
      reason: cleanReason,
      before,
      after: { disabled: true, disabledReason: cleanReason },
      requestId,
    });

    return { user: sanitizeUser(user), auditLog: audit };
  }

  async function unsuspendUser({ actorId, actorRole, targetUserId, reason = "", requestId = "" }) {
    const user = await UserModel.findById(targetUserId);
    if (!user) {
      throw createHttpError(404, "User not found", "user_not_found");
    }

    const before = { disabled: Boolean(user.disabled), disabledReason: user.disabledReason || "" };
    user.disabled = false;
    user.disabledReason = "";
    await user.save();

    if (redisClient && typeof redisClient.del === "function") {
      await redisClient.del(REDIS_KEYS.userBlacklist(String(user._id)));
    }

    const audit = await AuditLogModel.create({
      actorId: String(actorId),
      actorRole: canonicalizeRole(actorRole) || String(actorRole),
      action: "UNSUSPEND_USER",
      targetUserId: String(user._id),
      reason: String(reason || "").trim(),
      before,
      after: { disabled: false, disabledReason: "" },
      requestId,
    });

    return { user: sanitizeUser(user), auditLog: audit };
  }

  async function updateUserStatus({ actorId, actorRole, targetUserId, disabled, reason = "", requestId = "" }) {
    if (disabled) {
      return suspendUser({
        actorId,
        actorRole,
        targetUserId,
        reason: reason || "Disabled by administrator",
        requestId,
      });
    }
    return unsuspendUser({ actorId, actorRole, targetUserId, reason, requestId });
  }

  async function updateUserRole({ actorId, actorRole, targetUserId, role, reason = "", requestId = "" }) {
    const rawRole = String(role || "").trim().toLowerCase();
    if (!VALID_ROLES.has(rawRole)) {
      throw createHttpError(400, "Invalid target role", "invalid_role");
    }
    const nextRole = canonicalizeRole(rawRole);

    const user = await UserModel.findById(targetUserId);
    if (!user) {
      throw createHttpError(404, "User not found", "user_not_found");
    }

    const before = { role: canonicalizeRole(user.role) || user.role };
    user.role = nextRole;
    user.refreshTokenJti = null;
    await user.save();

    if (redisBus) {
      await redisBus.blacklistUser(String(user._id), REFRESH_TTL_SECONDS);
    }

    const audit = await AuditLogModel.create({
      actorId: String(actorId),
      actorRole: canonicalizeRole(actorRole) || String(actorRole),
      action: "UPDATE_ROLE",
      targetUserId: String(user._id),
      reason: String(reason || "").trim(),
      before,
      after: { role: nextRole },
      requestId,
    });

    return { user: sanitizeUser(user), auditLog: audit };
  }

  async function getCandidateProfile({ userId }) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw createHttpError(404, "Candidate not found", "user_not_found");
    }
    const profile = decryptProfileFields(user.candidateProfile || {}, piiEncryptionKey);
    const role = canonicalizeRole(user.role) || user.role;
    return {
      userId: String(user._id),
      name: user.name,
      email: user.email,
      profile,
      data: {
        user_id: String(user._id),
        email: user.email,
        full_name: user.name,
        role,
        profile,
        updated_at: user.updatedAt,
      },
    };
  }

  async function updateCandidateProfile({ userId, profile = {} }) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw createHttpError(404, "Candidate not found", "user_not_found");
    }

    const existingProfile =
      user.candidateProfile && typeof user.candidateProfile.toObject === "function"
        ? user.candidateProfile.toObject()
        : user.candidateProfile || {};

    const merged = {
      ...existingProfile,
      ...(profile.phone !== undefined ? { phone: profile.phone } : {}),
      ...(profile.location !== undefined ? { location: profile.location } : {}),
      ...(profile.address !== undefined && profile.location === undefined ? { location: profile.address } : {}),
      ...(profile.headline !== undefined ? { headline: String(profile.headline || "").trim() } : {}),
      ...(profile.bio !== undefined ? { bio: String(profile.bio || "").trim() } : {}),
      ...(profile.summary !== undefined ? { summary: String(profile.summary || "").trim(), bio: String(profile.summary || "").trim() } : {}),
      ...(profile.website !== undefined ? { website: String(profile.website || "").trim() } : {}),
      ...(Array.isArray(profile.portfolio_links)
        ? { portfolio_links: profile.portfolio_links.map((s) => String(s).trim()).filter(Boolean) }
        : {}),
      ...(Array.isArray(profile.skills) ? { skills: profile.skills.map((s) => String(s).trim()).filter(Boolean) } : {}),
      ...(profile.experienceYears !== undefined ? { experienceYears: Number(profile.experienceYears) || 0 } : {}),
      ...(Array.isArray(profile.experience) ? { experience: profile.experience } : {}),
      ...(Array.isArray(profile.education)
        ? { educationItems: profile.education }
        : profile.education !== undefined
          ? { education: String(profile.education || "").trim() }
          : {}),
      ...(Array.isArray(profile.portfolio) ? { portfolio: profile.portfolio } : {}),
      ...(profile.linkedinUrl !== undefined ? { linkedinUrl: String(profile.linkedinUrl || "").trim() } : {}),
      ...(profile.githubUrl !== undefined ? { githubUrl: String(profile.githubUrl || "").trim() } : {}),
      ...(profile.portfolioUrl !== undefined ? { portfolioUrl: String(profile.portfolioUrl || "").trim() } : {}),
    };

    user.candidateProfile = encryptProfileFields(merged, piiEncryptionKey);
    await user.save();

    const decrypted = decryptProfileFields(user.candidateProfile, piiEncryptionKey);
    const role = canonicalizeRole(user.role) || user.role;
    return {
      userId: String(user._id),
      name: user.name,
      email: user.email,
      profile: decrypted,
      data: {
        user_id: String(user._id),
        email: user.email,
        full_name: user.name,
        role,
        profile: decrypted,
        updated_at: user.updatedAt,
      },
    };
  }

  async function getCandidateProfileForViewer({ viewer, targetUserId }) {
    const isSelf = String(viewer.id) === String(targetUserId);
    const isOps = hasAnyRole(viewer.role, [ROLES.TECH_STAFF, ROLES.PLATFORM_OWNER]);
    const isRecruiter = hasAnyRole(viewer.role, [ROLES.RECRUITER]);

    if (!isSelf && !isOps) {
      if (!isRecruiter) {
        throw createHttpError(403, "Forbidden candidate profile access", "forbidden");
      }
      const allowed = await canRecruiterReadCandidateProfile(viewer.id, targetUserId);
      if (!allowed) {
        throw createHttpError(403, "Recruiter does not have access to this candidate profile", "forbidden");
      }
    }

    return getCandidateProfile({ userId: targetUserId });
  }

  return {
    signup,
    login,
    refresh,
    logout,
    changePassword,
    forgotPassword,
    resetPassword,
    getMe,
    updateMe,
    listUsers,
    suspendUser,
    unsuspendUser,
    updateUserStatus,
    updateUserRole,
    getCandidateProfile,
    updateCandidateProfile,
    getCandidateProfileForViewer,
  };
}
