import { MINIO_BUCKETS, createHttpError } from "@cvm/shared";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "png";
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  // WEBP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

/**
 * Company profile, taxCode verification, and MinIO brand logo management.
 */
export function createCompanyService({ CompanyModel, minioStorage }) {
  async function getMyCompany({ ownerId }) {
    const company = await CompanyModel.findOne({ ownerId: String(ownerId) });
    return company || null;
  }

  async function upsertMyCompany({ ownerId, payload = {} }) {
    const cleanName = payload.name !== undefined ? String(payload.name).trim() : undefined;
    const cleanTaxCode = payload.taxCode !== undefined ? String(payload.taxCode).trim() : undefined;

    if (cleanTaxCode) {
      const existingByTax = await CompanyModel.findOne({ taxCode: cleanTaxCode });
      if (existingByTax && String(existingByTax.ownerId) !== String(ownerId)) {
        throw createHttpError(409, "Tax code is already registered to another company", "duplicate_tax_code");
      }
    }

    const cleanSize = payload.size ?? payload.company_size ?? payload.companySize;
    const cleanLocation = payload.location ?? payload.address;
    const cleanBrandColor = payload.brandPrimaryColor ?? payload.brand_primary_color;
    const cleanBrandLogoUrl = payload.brandLogoUrl ?? payload.brand_logo_url;

    let company = await CompanyModel.findOne({ ownerId: String(ownerId) });
    if (!company) {
      if (!cleanName) {
        throw createHttpError(400, "Company name is required", "company_name_required");
      }
      company = await CompanyModel.create({
        ownerId: String(ownerId),
        name: cleanName,
        ...(cleanTaxCode ? { taxCode: cleanTaxCode, verificationStatus: "pending" } : {}),
        website: String(payload.website || "").trim(),
        industry: String(payload.industry || "").trim(),
        size: String(cleanSize || "").trim(),
        location: String(cleanLocation || "").trim(),
        description: String(payload.description || "").trim(),
        ...(cleanBrandColor ? { brandPrimaryColor: String(cleanBrandColor).trim() } : {}),
        ...(cleanBrandLogoUrl ? { brandLogoUrl: String(cleanBrandLogoUrl).trim() } : {}),
      });
      return company;
    }

    if (cleanName) company.name = cleanName;
    if (cleanTaxCode !== undefined) {
      company.taxCode = cleanTaxCode || undefined;
      if (cleanTaxCode && (company.verificationStatus === "unverified" || company.verificationStatus === "rejected")) {
        company.verificationStatus = "pending";
      }
    }
    if (payload.website !== undefined) company.website = String(payload.website).trim();
    if (payload.industry !== undefined) company.industry = String(payload.industry).trim();
    if (cleanSize !== undefined) company.size = String(cleanSize).trim();
    if (cleanLocation !== undefined) company.location = String(cleanLocation).trim();
    if (payload.description !== undefined) company.description = String(payload.description).trim();
    if (cleanBrandColor !== undefined) company.brandPrimaryColor = String(cleanBrandColor).trim();
    if (cleanBrandLogoUrl !== undefined) company.brandLogoUrl = String(cleanBrandLogoUrl).trim();

    await company.save();
    return company;
  }

  async function uploadCompanyLogo({ ownerId, file }) {
    if (!file || !file.buffer) {
      throw createHttpError(400, "Logo image file is required", "file_required");
    }
    if (file.buffer.length > MAX_LOGO_BYTES) {
      throw createHttpError(413, "Logo file exceeds 2MB limit", "uploaded_file_too_large");
    }
    const ext = detectImageType(file.buffer);
    if (!ext) {
      throw createHttpError(400, "Invalid image signature. Only PNG, JPG, or WEBP allowed.", "invalid_image_signature");
    }

    const company = await CompanyModel.findOne({ ownerId: String(ownerId) });
    if (!company) {
      throw createHttpError(404, "Create company profile before uploading logo", "company_not_found");
    }

    const objectKey = `${company._id}/logo.${ext}`;
    await minioStorage.uploadObject({
      bucket: MINIO_BUCKETS.COMPANY_ASSETS,
      objectKey,
      buffer: file.buffer,
      contentType: file.mimetype || `image/${ext === "jpg" ? "jpeg" : ext}`,
    });

    company.brandLogoUrl = objectKey;
    await company.save();
    return { company, objectKey };
  }

  async function listCompanies({ verificationStatus = null } = {}) {
    const filter = {};
    if (verificationStatus) {
      filter.verificationStatus = String(verificationStatus);
    }
    return CompanyModel.find(filter, null, { sort: { updatedAt: -1 } });
  }

  async function getCompanyById({ companyId }) {
    const company = await CompanyModel.findById(companyId);
    if (!company) {
      throw createHttpError(404, "Company not found", "company_not_found");
    }
    return company;
  }

  async function verifyCompany({ companyId, actorId, status, note = "" }) {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized !== "verified" && normalized !== "rejected") {
      throw createHttpError(400, "Verification status must be 'verified' or 'rejected'", "invalid_verification_status");
    }

    const company = await CompanyModel.findById(companyId);
    if (!company) {
      throw createHttpError(404, "Company not found", "company_not_found");
    }

    company.verificationStatus = normalized;
    company.verifiedBy = String(actorId);
    company.verifiedAt = new Date();
    company.verificationNote = String(note || "").trim();
    await company.save();
    return company;
  }

  return {
    getMyCompany,
    upsertMyCompany,
    uploadCompanyLogo,
    listCompanies,
    getCompanyById,
    verifyCompany,
  };
}
