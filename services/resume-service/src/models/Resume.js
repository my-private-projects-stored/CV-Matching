import mongoose from "mongoose";

const versionSnapshotSchema = new mongoose.Schema(
  {
    versionId: { type: String, required: true },
    savedAt: { type: Date, default: Date.now },
    title: { type: String, default: "" },
    parsedData: { type: mongoose.Schema.Types.Mixed, default: {} },
    builderData: { type: mongoose.Schema.Types.Mixed, default: null },
    rawText: { type: String, default: "" },
  },
  { _id: false }
);

const resumeSchema = new mongoose.Schema(
  {
    candidateId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "Untitled Resume",
      trim: true,
    },
    template: {
      type: String,
      default: "modern",
    },
    design: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    parsedData: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    builderData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    coverLetter: {
      type: String,
      default: null,
    },
    outreachMessage: {
      type: String,
      default: null,
    },
    rawText: {
      type: String,
      default: "",
    },
    rawTextHash: {
      type: String,
      default: "",
    },
    fileName: {
      type: String,
      default: "",
    },
    mimeType: {
      type: String,
      default: "",
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    fileUrl: {
      type: String,
      default: "",
    },
    storageBucket: {
      type: String,
      default: "resumes-bucket",
    },
    isMaster: {
      type: Boolean,
      default: false,
      index: true,
    },
    restoredFromVersionId: {
      type: String,
      default: null,
    },
    restoredAt: {
      type: Date,
      default: null,
    },
    isAnalyzed: {
      type: Boolean,
      default: false,
    },
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    processingError: {
      type: String,
      default: "",
    },
    vectorUpdatedAt: {
      type: Date,
      default: null,
    },
    vectorStale: {
      type: Boolean,
      default: false,
    },
    versions: {
      type: [versionSnapshotSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "resumes",
  }
);

const Resume = mongoose.models.Resume || mongoose.model("Resume", resumeSchema);
export default Resume;
