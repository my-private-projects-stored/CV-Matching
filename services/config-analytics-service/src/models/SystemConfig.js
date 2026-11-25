import mongoose from "mongoose";

const systemConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "system_configs",
  }
);

const SystemConfig =
  mongoose.models.SystemConfig || mongoose.model("SystemConfig", systemConfigSchema);
export default SystemConfig;
