import mongoose from "mongoose";

const { Schema, model } = mongoose;

const companySchema = new Schema(
  {
    recruiterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recruiter is required"],
      unique: true,
      index: true,
    },
    name: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    industry: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    website: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },
    companySize: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    address: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    brandPrimaryColor: {
      type: String,
      default: "#1D4ED8",
      trim: true,
    },
    brandLogoUrl: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export default model("Company", companySchema);
