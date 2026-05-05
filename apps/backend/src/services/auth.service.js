import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import { sendPasswordResetEmail } from "./mailer.service.js";

const AUTH_ROLES = new Set(["candidate", "recruiter", "admin"]);
const DEFAULT_ACCESS_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const DEFAULT_RESET_EXPIRES_IN = process.env.JWT_RESET_EXPIRES_IN || "30m";
const DEFAULT_APP_BASE_URL = process.env.APP_BASE_URL || process.env.FRONTEND_URL || "http://localhost:3000";
const PASSWORD_MIN_LENGTH = 8;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || "dev-only-jwt-secret-change-me";

  if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    throw createHttpError(500, "JWT_SECRET is required in production");
  }

  return secret;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function ensurePasswordPolicy(password, label = "Password") {
  const normalized = String(password || "");
  if (normalized.length < PASSWORD_MIN_LENGTH) {
    throw createHttpError(400, `${label} must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  return normalized;
}

function normalizeRole(role) {
  if (!role) return "candidate";
  const normalized = String(role).trim().toLowerCase();
  if (!AUTH_ROLES.has(normalized)) {
    throw createHttpError(400, `Unsupported role: ${normalized}`);
  }
  return normalized;
}

function toPublicUser(user) {
  return {
    id: String(user._id),
    email: user.email,
    role: user.role,
    full_name: user.fullName,
    avatar: user.avatar || null,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      email: user.email,
      role: user.role,
      type: "access",
    },
    getJwtSecret(),
    { expiresIn: DEFAULT_ACCESS_EXPIRES_IN }
  );
}

function signResetToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      email: user.email,
      type: "reset-password",
      prv: Number(user.passwordResetVersion || 0),
    },
    getJwtSecret(),
    { expiresIn: DEFAULT_RESET_EXPIRES_IN }
  );
}

function buildResetPasswordLink(token) {
  const url = new URL("/reset-password", DEFAULT_APP_BASE_URL);
  url.searchParams.set("token", token);
  return url.toString();
}

function buildResetEmail(user, token) {
  const resetLink = buildResetPasswordLink(token);

  return {
    to: user.email,
    subject: "Reset your password",
    reset_link: resetLink,
    text: [
      "We received a request to reset your password.",
      `Use this link to continue: ${resetLink}`,
      "If you did not request this change, you can ignore this message.",
    ].join("\n\n"),
  };
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, getJwtSecret());
  if (!payload || payload.type !== "access" || !payload.sub) {
    throw createHttpError(401, "Invalid access token");
  }

  return {
    userId: String(payload.sub),
    role: String(payload.role || ""),
    email: String(payload.email || ""),
  };
}

function verifyResetToken(token) {
  const payload = jwt.verify(token, getJwtSecret());
  if (!payload || payload.type !== "reset-password" || !payload.sub) {
    throw createHttpError(400, "Invalid reset token");
  }
  return {
    userId: String(payload.sub),
    resetVersion: Number(payload.prv || 0),
  };
}

export async function signupUser(input = {}) {
  const email = normalizeEmail(input.email);
  const password = ensurePasswordPolicy(input.password);
  const fullName = String(input.full_name || "").trim();
  const role = normalizeRole(input.role);

  if (!email) {
    throw createHttpError(400, "Email is required");
  }

  if (!fullName) {
    throw createHttpError(400, "Full name is required");
  }

  const existing = await User.findOne({ email }).lean();
  if (existing) {
    throw createHttpError(409, "Email is already registered");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    email,
    password: passwordHash,
    fullName,
    role,
  });

  const accessToken = signAccessToken(user);

  return {
    user: toPublicUser(user),
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: DEFAULT_ACCESS_EXPIRES_IN,
  };
}

export async function loginUser(input = {}) {
  const email = normalizeEmail(input.email);
  const password = String(input.password || "");

  if (!email || !password) {
    throw createHttpError(400, "Email and password are required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw createHttpError(401, "Invalid email or password");
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw createHttpError(401, "Invalid email or password");
  }

  const accessToken = signAccessToken(user);
  return {
    user: toPublicUser(user),
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: DEFAULT_ACCESS_EXPIRES_IN,
  };
}

export async function requestPasswordReset(input = {}) {
  const email = normalizeEmail(input.email);
  if (!email) {
    throw createHttpError(400, "Email is required");
  }

  const user = await User.findOne({ email });
  const response = {
    message: "If the account exists, a reset instruction has been generated",
  };

  if (!user) {
    return response;
  }

  const resetToken = signResetToken(user);
  await sendPasswordResetEmail(buildResetEmail(user, resetToken));

  if (process.env.NODE_ENV === "test" || process.env.AUTH_DEBUG_RESET_TOKEN === "1") {
    response.reset_token = resetToken;
  }

  return response;
}

export async function resetPassword(input = {}) {
  const token = String(input.token || "").trim();
  const nextPassword = ensurePasswordPolicy(input.new_password, "New password");

  if (!token) {
    throw createHttpError(400, "Reset token is required");
  }

  let tokenPayload;
  try {
    tokenPayload = verifyResetToken(token);
  } catch {
    throw createHttpError(400, "Invalid or expired reset token");
  }

  const user = await User.findById(tokenPayload.userId);
  if (!user) {
    throw createHttpError(404, "User not found");
  }

  if (Number(user.passwordResetVersion || 0) !== Number(tokenPayload.resetVersion || 0)) {
    throw createHttpError(400, "Invalid or expired reset token");
  }

  user.password = await bcrypt.hash(nextPassword, 10);
  user.passwordResetVersion = Number(user.passwordResetVersion || 0) + 1;
  await user.save();

  return { message: "Password has been reset successfully" };
}

export async function changePassword(input = {}) {
  const userId = String(input.userId || "").trim();
  const currentPassword = String(input.current_password || "");
  const nextPassword = ensurePasswordPolicy(input.new_password, "New password");

  if (!userId) {
    throw createHttpError(401, "Authentication is required");
  }

  if (!currentPassword) {
    throw createHttpError(400, "Current password is required");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw createHttpError(404, "User not found");
  }

  const isValidPassword = await bcrypt.compare(currentPassword, user.password);
  if (!isValidPassword) {
    throw createHttpError(401, "Current password is incorrect");
  }

  user.password = await bcrypt.hash(nextPassword, 10);
  user.passwordResetVersion = Number(user.passwordResetVersion || 0) + 1;
  await user.save();

  return { message: "Password updated successfully" };
}

export async function getCurrentUser(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw createHttpError(401, "Authentication is required");
  }

  const user = await User.findById(normalizedUserId);
  if (!user) {
    throw createHttpError(404, "User not found");
  }

  return { user: toPublicUser(user) };
}
