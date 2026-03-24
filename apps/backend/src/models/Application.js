import mongoose from "mongoose";

const { Schema, model } = mongoose;

const applicationSchema = new Schema(
  {
    // JD mục tiêu mà ứng viên đang nộp hồ sơ để tham gia quy trình tuyển dụng.
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: [true, "Job is required"],
      index: true,
    },

    // CV được dùng để apply, là nguồn dữ liệu cho scoring hybrid AI.
    resumeId: {
      type: Schema.Types.ObjectId,
      ref: "Resume",
      required: [true, "Resume is required"],
      index: true,
    },

    // Trạng thái xử lý hồ sơ theo pipeline tuyển dụng của HR.
    status: {
      type: String,
      enum: ["new", "screening", "interview", "offer", "hired", "rejected"],
      default: "new",
      required: [true, "Application status is required"],
    },

    // Trạng thái xử lý bất đồng bộ của pipeline AI (queue parsing/scoring).
    aiStatus: {
      type: String,
      enum: ["pending", "parsing", "scoring", "completed", "failed"],
      default: "pending",
      required: [true, "AI status is required"],
    },

    // Điểm AI tổng hợp để đo độ phù hợp giữa CV và JD.
    aiScores: {
      // Điểm ngữ nghĩa từ embedding/cosine similarity.
      semanticScore: {
        type: Number,
        default: 0,
      },

      // Điểm từ khóa từ BM25/TF-IDF cho mức độ khớp yêu cầu.
      keywordScore: {
        type: Number,
        default: 0,
      },

      // Điểm hybrid cuối cùng sau khi fusion semantic + keyword.
      hybridScore: {
        type: Number,
        default: 0,
      },
    },

    // Chi tiết Explainable AI để minh bạch vì sao ứng viên phù hợp/chưa phù hợp.
    aiDetails: {
      // Các từ khóa ứng viên đã đáp ứng theo JD.
      matchedKeywords: {
        type: [String],
        default: [],
      },

      // Các từ khóa còn thiếu để candidate cải thiện CV.
      missingKeywords: {
        type: [String],
        default: [],
      },
    },

    // Lịch sử chuyển trạng thái phục vụ audit tuyển dụng.
    statusHistory: {
      type: [
        {
          fromStatus: {
            type: String,
            enum: ["new", "screening", "interview", "offer", "hired", "rejected"],
            default: null,
          },
          toStatus: {
            type: String,
            enum: ["new", "screening", "interview", "offer", "hired", "rejected"],
            required: true,
          },
          changedAt: {
            type: Date,
            default: Date.now,
          },
          changedBy: {
            type: String,
            default: "system",
          },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

applicationSchema.index({ jobId: 1, status: 1 });
applicationSchema.index({ jobId: 1, aiStatus: 1 });
applicationSchema.index({ jobId: 1, resumeId: 1 }, { unique: true });

export default model("Application", applicationSchema);
