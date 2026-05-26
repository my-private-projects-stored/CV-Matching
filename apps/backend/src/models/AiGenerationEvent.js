import mongoose from "mongoose";

const { Schema, model } = mongoose;

/**
 * Stores LLM generation events (success and fallback) for observability.
 * Records are automatically deleted after 30 days via TTL index.
 */
const aiGenerationEventSchema = new Schema(
  {
    feature: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    generation_mode: {
      type: String,
      enum: ["llm", "template_fallback"],
      required: true,
      index: true,
    },
    provider: {
      type: String,
      trim: true,
      default: null,
    },
    model: {
      type: String,
      trim: true,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      default: null,
    },
    request_id: {
      type: String,
      trim: true,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: { expireAfterSeconds: 30 * 24 * 60 * 60 }, // 30-day TTL
    },
  },
  {
    timestamps: false, // We manage createdAt manually for TTL
    _id: true,
  }
);

export default model("AiGenerationEvent", aiGenerationEventSchema);
