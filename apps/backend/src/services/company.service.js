import Company from "../models/Company.js";
import User from "../models/User.js";

function createHttpError(statusCode, message, errorCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (errorCode) error.error_code = errorCode;
  return error;
}

function normalizeText(value, maxLength = 5000) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeWebsite(value) {
  const text = normalizeText(value);
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

function normalizeBrandColor(value) {
  const text = normalizeText(value).toUpperCase();
  return /^#[0-9A-F]{6}$/.test(text) ? text : "#1D4ED8";
}

function sanitizeCompanyProfile(input = {}) {
  return {
    name: normalizeText(input.name ?? input.company_name, 200),
    industry: normalizeText(input.industry, 160),
    website: normalizeWebsite(input.website),
    description: normalizeText(input.description ?? input.overview, 5000),
    companySize: normalizeText(input.companySize ?? input.company_size, 80),
    address: normalizeText(input.address, 500),
    brandPrimaryColor: normalizeBrandColor(input.brandPrimaryColor ?? input.brand_primary_color),
    brandLogoUrl: normalizeText(input.brandLogoUrl ?? input.brand_logo_url),
  };
}

export function toCompanyDto(company) {
  if (!company) return null;
  const doc = typeof company.toObject === "function" ? company.toObject() : company;
  return {
    id: String(doc._id),
    recruiter_id: doc.recruiterId ? String(doc.recruiterId) : null,
    name: doc.name || "",
    company_name: doc.name || "",
    industry: doc.industry || "",
    website: doc.website || "",
    description: doc.description || "",
    overview: doc.description || "",
    company_size: doc.companySize || "",
    address: doc.address || "",
    brand_primary_color: doc.brandPrimaryColor || "#1D4ED8",
    brand_logo_url: doc.brandLogoUrl || "",
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

async function assertRecruiter(userId) {
  const user = await User.findById(userId).select("role").lean();
  if (!user) {
    throw createHttpError(404, "User not found", "company_user_not_found");
  }
  if (user.role !== "recruiter" && user.role !== "admin") {
    throw createHttpError(403, "Only recruiters can manage company profiles", "company_forbidden_role");
  }
}

export async function getMyCompanyProfile(userId) {
  if (!userId) {
    throw createHttpError(401, "Authentication is required", "company_auth_required");
  }
  await assertRecruiter(userId);
  const company = await Company.findOneAndUpdate(
    { recruiterId: userId },
    { $setOnInsert: { recruiterId: userId } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return toCompanyDto(company);
}

export async function updateMyCompanyProfile(userId, input = {}) {
  if (!userId) {
    throw createHttpError(401, "Authentication is required", "company_auth_required");
  }
  await assertRecruiter(userId);
  const company = await Company.findOneAndUpdate(
    { recruiterId: userId },
    { $set: sanitizeCompanyProfile(input), $setOnInsert: { recruiterId: userId } },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
  return toCompanyDto(company);
}

export async function getCompanyProfileById(companyId) {
  const company = await Company.findById(companyId).lean();
  return toCompanyDto(company);
}
