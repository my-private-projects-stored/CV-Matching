import mongoose from "mongoose";

const jobStatusMirrorSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    recruiterId: {
      type: String,
      default: "",
    },
    title: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      default: "general",
    },
    status: {
      type: String,
      enum: ["draft", "active", "open", "closed", "deleted"],
      required: true,
    },
    syncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "job_status_mirror",
  }
);

const JobStatusMirror =
  mongoose.models.JobStatusMirror || mongoose.model("JobStatusMirror", jobStatusMirrorSchema);
export default JobStatusMirror;
