import mongoose from "mongoose";

const statusHistoryEntrySchema = new mongoose.Schema(
  {
    fromStatus: {
      type: String,
      enum: ["draft", "new", "screening", "interview", "offer", "hired", "rejected", "withdrawn", null],
      default: null,
    },
    toStatus: {
      type: String,
      enum: ["draft", "new", "screening", "interview", "offer", "hired", "rejected", "withdrawn"],
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    changedBy: {
      type: String,
      default: "system",
    },
    reason: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    candidateId: {
      type: String,
      required: true,
      index: true,
    },
    jobId: {
      type: String,
      required: true,
      index: true,
    },
    resumeId: {
      type: String,
      required: true,
      index: true,
    },
    recruiterId: {
      type: String,
      default: "",
      index: true,
    },
    candidateName: {
      type: String,
      default: "",
    },
    candidateEmail: {
      type: String,
      default: "",
    },
    resumeTitle: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["draft", "new", "screening", "interview", "offer", "hired", "rejected", "withdrawn"],
      default: "new",
      required: true,
    },
    aiStatus: {
      type: String,
      enum: ["pending", "parsing", "scoring", "completed", "failed"],
      default: "pending",
      required: true,
    },
    aiScores: {
      semanticScore: { type: Number, default: 0 },
      keywordScore: { type: Number, default: 0 },
      hybridScore: { type: Number, default: 0 },
    },
    aiDetails: {
      matchedKeywords: { type: [String], default: [] },
      missingKeywords: { type: [String], default: [] },
    },
    scoringError: {
      type: String,
      default: "",
    },
    manualScreeningOverride: {
      type: Boolean,
      default: false,
    },
    withdrawnAt: {
      type: Date,
      default: null,
    },
    statusHistory: {
      type: [statusHistoryEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "applications",
    optimisticConcurrency: true,
  }
);

applicationSchema.index({ jobId: 1, status: 1 });
applicationSchema.index({ jobId: 1, aiStatus: 1 });
applicationSchema.index({ candidateId: 1, createdAt: -1 });
applicationSchema.index(
  { jobId: 1, resumeId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: "withdrawn" } },
  }
);

const Application = mongoose.models.Application || mongoose.model("Application", applicationSchema);
export default Application;
