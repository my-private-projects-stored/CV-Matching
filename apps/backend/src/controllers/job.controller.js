import { createJob, deleteJobById, updateJobById } from "../services/job.service.js";

export async function createJobHandler(req, res, next) {
  try {
    const created = await createJob(req.body);
    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
}

export async function updateJobHandler(req, res, next) {
  try {
    const updated = await updateJobById(req.params.id, req.body);

    if (!updated) {
      return res.status(404).json({ message: "Job not found" });
    }

    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
}

export async function deleteJobHandler(req, res, next) {
  try {
    const deleted = await deleteJobById(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Job not found" });
    }

    return res.status(200).json({ message: "Job deleted", id: String(deleted._id) });
  } catch (error) {
    return next(error);
  }
}
