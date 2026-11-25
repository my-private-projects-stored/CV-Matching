import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: String,
      required: true,
      index: true,
    },
    actorRole: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: ["SUSPEND_USER", "UNSUSPEND_USER", "UPDATE_ROLE", "UPDATE_STATUS"],
      index: true,
    },
    targetUserId: {
      type: String,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    requestId: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "audit_logs",
  }
);

const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;
