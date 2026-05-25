import {
  getCompanyProfileById,
  getMyCompanyProfile,
  updateMyCompanyProfile,
} from "../services/company.service.js";

export async function getMyCompanyProfileHandler(req, res, next) {
  try {
    const data = await getMyCompanyProfile(req.auth?.userId);
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

export async function updateMyCompanyProfileHandler(req, res, next) {
  try {
    const data = await updateMyCompanyProfile(req.auth?.userId, req.body || {});
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

export async function getCompanyProfileByIdHandler(req, res, next) {
  try {
    const data = await getCompanyProfileById(req.params.id);
    if (!data) {
      return res.status(404).json({ message: "Company not found" });
    }
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}
