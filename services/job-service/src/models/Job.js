import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    recruiterId: {
      type: String,
      required: true,
      index: true,
    },
    companyId: {
      type: String,
      default: "",
      index: true,
    },
    companyName: {
      type: String,
      default: "",
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    requirements: {
      type: String,
      default: "",
      trim: true,
    },
    benefits: {
      type: String,
      default: "",
      trim: true,
    },
    applicationDeadline: {
      type: Date,
      default: null,
    },
    skills: {
      type: [String],
      default: [],
    },
    category: {
      type: String,
      default: "general",
      trim: true,
      index: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    employmentType: {
      type: String,
      default: "full-time",
      trim: true,
    },
    experienceLevel: {
      type: String,
      default: "",
      trim: true,
    },
    salaryMin: {
      type: Number,
      default: null,
    },
    salaryMax: {
      type: Number,
      default: null,
    },
    salaryCurrency: {
      type: String,
      default: "VND",
    },
    status: {
      type: String,
      enum: ["draft", "active", "open", "closed", "deleted"],
      default: "draft",
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    vectorUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "jobs",
  }
);

const Job = mongoose.models.Job || mongoose.model("Job", jobSchema);
export default Job;
