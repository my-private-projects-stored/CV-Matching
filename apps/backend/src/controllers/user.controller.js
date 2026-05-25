import User from "../models/User.js";

function toUserDto(user) {
  return {
    _id: String(user._id),
    id: String(user._id),
    email: user.email,
    fullName: user.fullName,
    full_name: user.fullName,
    role: user.role,
    avatar: user.avatar || null,
    disabled: Boolean(user.disabled),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

export async function listUsersHandler(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query?.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query?.limit || "50"), 10) || 50));
    const skip = (page - 1) * limit;
    const role = String(req.query?.role || "").trim().toLowerCase();
    const filter = {};

    if (["candidate", "recruiter", "admin"].includes(role)) {
      filter.role = role;
    }

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      data: users.map(toUserDto),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateUserStatusHandler(req, res, next) {
  try {
    const disabled = Boolean(req.body?.disabled);
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { disabled },
      { new: true, runValidators: true }
    ).lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ data: toUserDto(user) });
  } catch (error) {
    return next(error);
  }
}
