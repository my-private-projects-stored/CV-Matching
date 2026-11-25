import mongoose from "mongoose";
import { ROLES, canonicalizeRole } from "@cvm/shared";

const candidateProfileSchema = new mongoose.Schema(
  {
    phone: { type: String, default: "", trim: true },
    location: { type: String, default: "", trim: true },
    headline: { type: String, default: "", trim: true },
    bio: { type: String, default: "", trim: true },
    summary: { type: String, default: "", trim: true },
    website: { type: String, default: "", trim: true },
    portfolio_links: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    experienceYears: { type: Number, min: 0, max: 60, default: 0 },
    education: { type: String, default: "", trim: true },
    experience: { type: [mongoose.Schema.Types.Mixed], default: [] },
    educationItems: { type: [mongoose.Schema.Types.Mixed], default: [] },
    portfolio: { type: [mongoose.Schema.Types.Mixed], default: [] },
    linkedinUrl: { type: String, default: "", trim: true },
    githubUrl: { type: String, default: "", trim: true },
    portfolioUrl: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: [
        ROLES.CANDIDATE,
        ROLES.RECRUITER,
        ROLES.TECH_STAFF,
        ROLES.PLATFORM_OWNER,
        ROLES.ADMIN_ALIAS,
      ],
      default: ROLES.CANDIDATE,
    },
    disabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    disabledReason: {
      type: String,
      default: "",
      trim: true,
    },
    refreshTokenJti: {
      type: String,
      default: null,
    },
    resetPasswordTokenHash: {
      type: String,
      default: null,
      index: true,
    },
    resetPasswordExpiresAt: {
      type: Date,
      default: null,
    },
    candidateProfile: {
      type: candidateProfileSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: String(this._id),
    name: this.name,
    full_name: this.name,
    email: this.email,
    role: canonicalizeRole(this.role) || this.role,
    rawRole: this.role,
    avatar: null,
    disabled: Boolean(this.disabled),
    disabledReason: this.disabledReason || "",
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
