import mongoose from "mongoose";

const { Schema, model } = mongoose;

const jobSchema = new Schema(
  {
    // Tham chiếu nhà tuyển dụng tạo JD để truy vết ownership và phân quyền.
    recruiterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recruiter is required"],
      index: true,
    },

    // Tiêu đề vị trí tuyển dụng dùng để hiển thị và tìm kiếm nhanh.
    title: {
      type: String,
      required: [true, "Job title is required"],
      trim: true,
      maxlength: [200, "Job title is too long"],
    },

    // Mô tả công việc gốc do HR nhập, làm đầu vào cho pipeline AI.
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },

    // Danh sách yêu cầu gốc của JD, phục vụ đối sánh kỹ năng và kinh nghiệm.
    requirements: {
      type: String,
      required: [true, "Requirements are required"],
      trim: true,
    },

    // Quyền lợi cho vị trí tuyển dụng, phục vụ hiển thị rõ gói offer cho ứng viên.
    benefits: {
      type: String,
      default: "",
      trim: true,
    },

    // Deadline nhận hồ sơ ứng tuyển.
    applicationDeadline: {
      type: Date,
      default: null,
      index: true,
    },

    // Văn bản đã chuẩn hóa (clean text) để tạo embedding và chấm điểm semantic.
    cleanText: {
      type: String,
      required: [true, "Clean text is required"],
      trim: true,
    },

    // ID UUID để map 1-1 với point_id của JD trong Qdrant.
    qdrantId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    // Cờ đánh dấu JD đã được vector hoa va indexing sang AI pipeline hay chưa.
    isAnalyzed: {
      type: Boolean,
      default: false,
    },

    // Tập từ khóa trích xuất từ JD để tính keyword score (BM25/TF-IDF).
    keywords: {
      type: [String],
      default: [],
    },

    // Nhóm ngành nghề để lọc và thống kê trên dashboard tuyển dụng.
    category: {
      type: String,
      enum: ["IT", "Accounting", "Marketing"],
      required: [true, "Category is required"],
      index: true,
    },

    // Địa điểm làm việc để candidate lọc và HR thống kê theo khu vực.
    location: {
      type: String,
      default: "Not specified",
      trim: true,
    },

    // Mức kinh nghiệm yêu cầu phục vụ matching theo seniority.
    experienceLevel: {
      type: String,
      default: "Any",
      trim: true,
    },

    // Trạng thái tin tuyển dụng để điều khiển việc nhận hồ sơ.
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
      required: [true, "Status is required"],
    },

    // Lưu các thay đổi quan trọng để audit thao tác recruiter.
    importantChangeHistory: {
      type: [
        {
          changedAt: {
            type: Date,
            required: true,
            default: Date.now,
          },
          changedFields: {
            type: [String],
            default: [],
          },
          changes: {
            type: [
              {
                field: {
                  type: String,
                  required: true,
                  trim: true,
                },
                before: {
                  type: Schema.Types.Mixed,
                  default: null,
                },
                after: {
                  type: Schema.Types.Mixed,
                  default: null,
                },
              },
            ],
            default: [],
          },
          summary: {
            type: String,
            default: "",
            trim: true,
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

export default model("Job", jobSchema);
