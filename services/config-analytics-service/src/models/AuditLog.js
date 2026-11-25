import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: String, required: true, index: true },
    actorRole: { type: String, required: true },
    action: {
      type: String,
      required: true,
      enum: ["UPDATE_CONFIG", "RETRY_DLQ", "REINDEX_VECTORS"],
      index: true,
    },
    targetKey: { type: String, required: true, index: true },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    reason: { type: String, default: "", trim: true },
    requestId: { type: String, default: "" },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "audit_logs",
  }
);

const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;
