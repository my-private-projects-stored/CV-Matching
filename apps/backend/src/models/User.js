import mongoose from "mongoose";

const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    // Email đăng nhập duy nhất để định danh người dùng trong hệ thống tuyển dụng.
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },

    // Mật khẩu đã băm (hash) để đảm bảo an toàn thông tin xác thực.
    password: {
      type: String,
      required: [true, "Password hash is required"],
      minlength: [60, "Password hash looks invalid"],
    },

    // Vai trò người dùng để phân quyền luồng nghiệp vụ (candidate/recruiter/admin).
    role: {
      type: String,
      enum: ["candidate", "recruiter", "admin"],
      required: [true, "Role is required"],
      default: "candidate",
    },

    // Họ tên hiển thị trên dashboard và các màn hình nghiệp vụ tuyển dụng.
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: [120, "Full name is too long"],
    },

    // Ảnh đại diện phục vụ hiển thị hồ sơ người dùng.
    avatar: {
      type: String,
      default: null,
      trim: true,
    },

    // Profile ứng viên dùng cho UC-BASIC-05, tái sử dụng qua nhiều lần ứng tuyển.
    candidateProfile: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export default model("User", userSchema);
