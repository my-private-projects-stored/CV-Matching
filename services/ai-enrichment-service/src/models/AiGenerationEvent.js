import mongoose from "mongoose";

const aiGenerationEventSchema = new mongoose.Schema(
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
    userId: {
      type: String,
      default: null,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: { expireAfterSeconds: 30 * 24 * 60 * 60 },
    },
  },
  {
    timestamps: false,
    collection: "ai_generation_events",
  }
);

const AiGenerationEvent =
  mongoose.models.AiGenerationEvent || mongoose.model("AiGenerationEvent", aiGenerationEventSchema);
export default AiGenerationEvent;
