import {
  getMyCandidateProfile,
  updateMyCandidateProfile,
} from "../services/candidate-profile.service.js";

export async function getMyCandidateProfileHandler(req, res, next) {
  try {
    const data = await getMyCandidateProfile(req.auth?.userId);
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

export async function updateMyCandidateProfileHandler(req, res, next) {
  try {
    const data = await updateMyCandidateProfile(req.auth?.userId, req.body || {});
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}
