import mongoose from "mongoose";

import Application from "../models/Application.js";
import Job from "../models/Job.js";
import Resume from "../models/Resume.js";
import User from "../models/User.js";

const MAX_TEXT = 500;
const MAX_LONG_TEXT = 5000;

// Guardrail limits
const MAX_EXPERIENCE_ITEMS = 20;
const MAX_EDUCATION_ITEMS = 20;
const MAX_PORTFOLIO_ITEMS = 50;
const MAX_HEADLINE_LENGTH = 200;
const MIN_SUMMARY_LENGTH = 20;
const MAX_SUMMARY_LENGTH = MAX_LONG_TEXT;
const MAX_EDUCATION_TEXT_LENGTH = 200;
const MAX_PORTFOLIO_DESCRIPTION_LENGTH = 1000;
const MAX_PORTFOLIO_URL_LENGTH = MAX_LONG_TEXT;

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

function validateCandidateProfileInput(input = {}) {
  // Validate counts
  if (Array.isArray(input.experience) && input.experience.length > MAX_EXPERIENCE_ITEMS) {
    throw createHttpError(
      400,
      `Too many experience items: max ${MAX_EXPERIENCE_ITEMS}`,
      'candidate_profile_too_many_experience_items'
    );
  }

  if (Array.isArray(input.education) && input.education.length > MAX_EDUCATION_ITEMS) {
    throw createHttpError(
      400,
      `Too many education items: max ${MAX_EDUCATION_ITEMS}`,
      'candidate_profile_too_many_education_items'
    );
  }

  if (Array.isArray(input.portfolio) && input.portfolio.length > MAX_PORTFOLIO_ITEMS) {
    throw createHttpError(
      400,
      `Too many portfolio items: max ${MAX_PORTFOLIO_ITEMS}`,
      'candidate_profile_too_many_portfolio_items'
    );
  }

  // Headline length
  if (String(input.headline || '').trim().length > MAX_HEADLINE_LENGTH) {
    throw createHttpError(400, 'Headline too long', 'candidate_profile_headline_too_long');
  }

  // Summary length (too short or too long)
  const summaryLen = String(input.summary || '').trim().length;
  if (summaryLen > 0 && summaryLen < MIN_SUMMARY_LENGTH) {
    throw createHttpError(400, 'Summary too short', 'candidate_profile_summary_too_short');
  }
  if (summaryLen > MAX_SUMMARY_LENGTH) {
    throw createHttpError(400, 'Summary too long', 'candidate_profile_summary_too_long');
  }

  // Per-item length checks (experience summary)
  if (Array.isArray(input.experience)) {
    for (const item of input.experience) {
      if (String(item?.summary || '').trim().length > MAX_LONG_TEXT) {
        throw createHttpError(
          400,
          'Experience summary too long',
          'candidate_profile_experience_summary_too_long'
        );
      }
    }
  }

  // Per-item length checks (education)
  if (Array.isArray(input.education)) {
    for (const item of input.education) {
      if (String(item?.school || '').trim().length > MAX_EDUCATION_TEXT_LENGTH) {
        throw createHttpError(
          400,
          'Education school too long',
          'candidate_profile_education_school_too_long'
        );
      }
      if (String(item?.degree || '').trim().length > MAX_EDUCATION_TEXT_LENGTH) {
        throw createHttpError(
          400,
          'Education degree too long',
          'candidate_profile_education_degree_too_long'
        );
      }
      if (String(item?.field || '').trim().length > MAX_EDUCATION_TEXT_LENGTH) {
        throw createHttpError(
          400,
          'Education field too long',
          'candidate_profile_education_field_too_long'
        );
      }
      if (String(item?.summary || '').trim().length > MAX_LONG_TEXT) {
        throw createHttpError(
          400,
          'Education summary too long',
          'candidate_profile_education_summary_too_long'
        );
      }
    }
  }

  // Per-item length checks (portfolio)
  if (Array.isArray(input.portfolio)) {
    for (const item of input.portfolio) {
      if (String(item?.name || '').trim().length > 200) {
        throw createHttpError(
          400,
          'Portfolio name too long',
          'candidate_profile_portfolio_name_too_long'
        );
      }
      if (String(item?.url || '').trim().length > MAX_PORTFOLIO_URL_LENGTH) {
        throw createHttpError(
          400,
          'Portfolio url too long',
          'candidate_profile_portfolio_url_too_long'
        );
      }
      if (String(item?.description || '').trim().length > MAX_PORTFOLIO_DESCRIPTION_LENGTH) {
        throw createHttpError(
          400,
          'Portfolio description too long',
          'candidate_profile_portfolio_description_too_long'
        );
      }
    }
  }
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

async function assertRecruiterCanReadCandidateProfile(candidateUserId, recruiterUserId) {
  if (!recruiterUserId) {
    throw createHttpError(401, "Authentication is required", "candidate_profile_auth_required");
  }

  const recruiterJobs = await Job
    .find({ recruiterId: recruiterUserId })
    .select("_id")
    .lean();
  const jobIds = recruiterJobs.map((item) => item._id);
  if (jobIds.length === 0) {
    throw createHttpError(
      403,
      "You do not have permission to view this candidate profile",
      "candidate_profile_forbidden_recruiter"
    );
  }

  const candidateResumes = await Resume
    .find({ candidateId: candidateUserId })
    .select("_id")
    .lean();
  const resumeIds = candidateResumes.map((item) => item._id);
  if (resumeIds.length === 0) {
    throw createHttpError(
      403,
      "You do not have permission to view this candidate profile",
      "candidate_profile_forbidden_recruiter"
    );
  }

  const application = await Application
    .findOne({
      jobId: { $in: jobIds },
      resumeId: { $in: resumeIds },
    })
    .select("_id")
    .lean();

  if (!application) {
    throw createHttpError(
      403,
      "You do not have permission to view this candidate profile",
      "candidate_profile_forbidden_recruiter"
    );
  }
}

export async function getMyCandidateProfile(userId) {
  const user = await loadCandidateUser(userId);
  return toCandidateProfileDto(user);
}

export async function getCandidateProfileById(candidateUserId, actor = {}) {
  const user = await loadCandidateUserById(candidateUserId);
  const role = String(actor.role || "").trim().toLowerCase();
  const actorUserId = String(actor.userId || "").trim();

  if (role === "recruiter") {
    await assertRecruiterCanReadCandidateProfile(String(user._id), actorUserId);
  } else if (role !== "admin") {
    throw createHttpError(
      403,
      "You do not have permission to view this candidate profile",
      "candidate_profile_forbidden_role"
    );
  }

  return toCandidateProfileDto(user);
}

export async function updateMyCandidateProfile(userId, input = {}) {
  const user = await loadCandidateUser(userId);
  validateCandidateProfileInput(input);
  user.candidateProfile = sanitizeCandidateProfile(input);
  await user.save();
  return toCandidateProfileDto(user);
}
