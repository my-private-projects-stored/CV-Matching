import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    ownerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    taxCode: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    verificationStatus: {
      type: String,
      enum: ["unverified", "pending", "verified", "rejected"],
      default: "unverified",
      index: true,
    },
    verifiedBy: {
      type: String,
      default: "",
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verificationNote: {
      type: String,
      default: "",
      trim: true,
    },
    brandLogoUrl: {
      type: String,
      default: "",
    },
    brandPrimaryColor: {
      type: String,
      default: "#1D4ED8",
      trim: true,
    },
    website: {
      type: String,
      default: "",
      trim: true,
    },
    industry: {
      type: String,
      default: "",
      trim: true,
    },
    size: {
      type: String,
      default: "",
      trim: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "companies",
  }
);

const Company = mongoose.models.Company || mongoose.model("Company", companySchema);
export default Company;
