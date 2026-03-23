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

    // Trạng thái xử lý hiển thị cho frontend dashboard.
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "ready", "failed"],
      default: "pending",
      index: true,
    },

    // Tên file gốc khi upload.
    filename: {
      type: String,
      default: null,
      trim: true,
    },

    // Bản gốc file upload để hỗ trợ HR tải xuống CV gốc theo use-case.
    sourceFile: {
      filename: {
        type: String,
        default: null,
        trim: true,
      },
      mimeType: {
        type: String,
        default: null,
        trim: true,
      },
      size: {
        type: Number,
        default: 0,
      },
      data: {
        type: Buffer,
        default: null,
      },
    },

    // CV gốc (master resume) để làm baseline cho tailored resumes.
    isMaster: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Tham chiếu đến CV cha nếu đây là bản tailored.
    parentResumeId: {
      type: Schema.Types.ObjectId,
      ref: "Resume",
      default: null,
      index: true,
    },

    // Tiêu đề hiển thị trong dashboard/builder.
    title: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120,
    },

    // Nội dung generated cho các màn hình liên quan.
    coverLetter: {
      type: String,
      default: null,
    },
    outreachMessage: {
      type: String,
      default: null,
    },

    // Job context cho tailored resume.
    jobDescription: {
      type: String,
      default: null,
    },
    jobId: {
      type: String,
      default: null,
      trim: true,
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
