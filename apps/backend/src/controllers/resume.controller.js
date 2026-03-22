import {
  createResume,
  deleteResumeById,
  updateResumeById,
} from "../services/resume.service.js";

export async function createResumeHandler(req, res, next) {
  try {
    const created = await createResume(req.body);
    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
}

export async function updateResumeHandler(req, res, next) {
  try {
    const updated = await updateResumeById(req.params.id, req.body);

    if (!updated) {
      return res.status(404).json({ message: "Resume not found" });
    }

    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
}

export async function deleteResumeHandler(req, res, next) {
  try {
    const deleted = await deleteResumeById(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Resume not found" });
    }

    return res.status(200).json({ message: "Resume deleted", id: String(deleted._id) });
  } catch (error) {
    return next(error);
  }
}
