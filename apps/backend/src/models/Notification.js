import mongoose from "mongoose";

const { Schema, model } = mongoose;

const notificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
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
    payload: { type: Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null, index: true },
    emailSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

const Notification = model("Notification", notificationSchema);

export default Notification;
