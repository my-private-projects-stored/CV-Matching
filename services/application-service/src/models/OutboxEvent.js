import mongoose from "mongoose";

const outboxEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      enum: ["APPLICATION_SUBMITTED", "APPLICATION_STATUS_CHANGED", "APPLICATION_RETRY_SCORING"],
      index: true,
    },
    aggregateId: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "published", "failed"],
      default: "pending",
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastError: {
      type: String,
      default: "",
    },
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "outbox_events",
  }
);

const OutboxEvent = mongoose.models.OutboxEvent || mongoose.model("OutboxEvent", outboxEventSchema);
export default OutboxEvent;
