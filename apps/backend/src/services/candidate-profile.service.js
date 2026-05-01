import mongoose from "mongoose";

import User from "../models/User.js";

const MAX_TEXT = 500;
const MAX_LONG_TEXT = 5000;

function createHttpError(statusCode, message, errorCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (errorCode) {
    error.error_code = errorCode;
  }
  return error;
}

function normalizeText(value, maxLength = MAX_TEXT) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeUrl(value) {
  const text = normalizeText(value, MAX_LONG_TEXT);
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

function normalizeList(values, maxItems = 100, maxLength = MAX_TEXT) {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => normalizeText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeExperience(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 50).map((item) => ({
    title: normalizeText(item?.title, 160),
    company: normalizeText(item?.company, 160),
    location: normalizeText(item?.location, 160),
    start_date: normalizeText(item?.start_date, 40),
    end_date: normalizeText(item?.end_date, 40),
    summary: normalizeText(item?.summary, MAX_LONG_TEXT),
  }));
}

function normalizeEducation(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 50).map((item) => ({
    school: normalizeText(item?.school, 200),
    degree: normalizeText(item?.degree, 200),
    field: normalizeText(item?.field, 200),
    start_date: normalizeText(item?.start_date, 40),
    end_date: normalizeText(item?.end_date, 40),
    summary: normalizeText(item?.summary, MAX_LONG_TEXT),
  }));
}

function normalizePortfolio(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 100).map((item) => ({
    name: normalizeText(item?.name, 200),
    url: normalizeUrl(item?.url),
    description: normalizeText(item?.description, 1000),
  }));
}

function sanitizeCandidateProfile(input = {}) {
  return {
    headline: normalizeText(input.headline, 200),
    summary: normalizeText(input.summary, MAX_LONG_TEXT),
    phone: normalizeText(input.phone, 60),
    location: normalizeText(input.location, 160),
    website: normalizeUrl(input.website),
    portfolio_links: normalizeList(input.portfolio_links, 50, 500),
    skills: normalizeList(input.skills, 200, 100),
    experience: normalizeExperience(input.experience),
    education: normalizeEducation(input.education),
    portfolio: normalizePortfolio(input.portfolio),
  };
}

function toCandidateProfileDto(user) {
  const profile = sanitizeCandidateProfile(user?.candidateProfile || {});
  return {
    user_id: String(user._id),
    email: user.email,
    full_name: user.fullName,
    role: user.role,
    profile,
    updated_at: user.updatedAt,
  };
}

function assertValidUserId(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw createHttpError(400, "User id is required", "candidate_profile_user_id_required");
  }
  if (!mongoose.Types.ObjectId.isValid(normalizedUserId)) {
    throw createHttpError(400, "Invalid user id", "candidate_profile_invalid_user_id");
  }
  return normalizedUserId;
}

async function loadCandidateUser(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw createHttpError(401, "Authentication is required", "candidate_profile_auth_required");
  }

  const user = await User.findById(normalizedUserId);
  if (!user) {
    throw createHttpError(404, "User not found", "candidate_profile_user_not_found");
  }

  if (user.role !== "candidate" && user.role !== "admin") {
    throw createHttpError(
      403,
      "Only candidate profile is supported for this account",
      "candidate_profile_forbidden_role"
    );
  }

  return user;
}

async function loadCandidateUserById(candidateUserId) {
  const normalizedUserId = assertValidUserId(candidateUserId);
  const user = await User.findById(normalizedUserId);
  if (!user) {
    throw createHttpError(404, "User not found", "candidate_profile_user_not_found");
  }

  if (user.role !== "candidate" && user.role !== "admin") {
    throw createHttpError(
      403,
      "Only candidate profile is supported for this account",
      "candidate_profile_forbidden_role"
    );
  }

  return user;
}

export async function getMyCandidateProfile(userId) {
  const user = await loadCandidateUser(userId);
  return toCandidateProfileDto(user);
}

export async function getCandidateProfileById(candidateUserId) {
  const user = await loadCandidateUserById(candidateUserId);
  return toCandidateProfileDto(user);
}

export async function updateMyCandidateProfile(userId, input = {}) {
  const user = await loadCandidateUser(userId);
  user.candidateProfile = sanitizeCandidateProfile(input);
  await user.save();
  return toCandidateProfileDto(user);
}
