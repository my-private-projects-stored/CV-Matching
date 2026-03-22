import mongoose from "mongoose";

const { Schema, model } = mongoose;

const resumeSchema = new Schema(
  {
    // Ứng viên sở hữu CV, dùng để gắn hồ sơ với tài khoản candidate.
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Candidate is required"],
      index: true,
    },

    // Đường dẫn file CV gốc trên storage để HR có thể tải/xem lại.
    fileUrl: {
      type: String,
      required: [true, "File URL is required"],
      trim: true,
    },

    // Nội dung text thô trích xuất từ CV làm đầu vào cho bước phân tích AI.
    rawText: {
      type: String,
      default: "",
      trim: true,
    },

    // ID UUID để map 1-1 với point_id của CV trong Qdrant.
    qdrantId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    // Kết quả parse có cấu trúc từ Resume-Matcher (skills, education, projects...).
    parsedData: {
      type: Schema.Types.Mixed,
      default: {},
    },

    // Cờ đánh dấu CV đã qua pipeline phân tích hay chưa.
    isAnalyzed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default model("Resume", resumeSchema);
