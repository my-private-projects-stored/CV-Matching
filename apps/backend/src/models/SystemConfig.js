import mongoose from "mongoose";

const { Schema, model } = mongoose;

const systemConfigSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export default model("SystemConfig", systemConfigSchema);
