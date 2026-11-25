import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["application_status_changed", "ai_scoring_completed", "job_closed"],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    readAt: { type: Date, default: null, index: true },
    emailSent: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: "notifications",
  }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
export default Notification;
