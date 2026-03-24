import {
  changePassword,
  getCurrentUser,
  loginUser,
  requestPasswordReset,
  resetPassword,
  signupUser,
} from "../services/auth.service.js";

export async function signupHandler(req, res, next) {
  try {
    const result = await signupUser(req.body || {});
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function loginHandler(req, res, next) {
  try {
    const result = await loginUser(req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function forgotPasswordHandler(req, res, next) {
  try {
    const result = await requestPasswordReset(req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function resetPasswordHandler(req, res, next) {
  try {
    const result = await resetPassword(req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function changePasswordHandler(req, res, next) {
  try {
    const result = await changePassword({
      ...(req.body || {}),
      userId: req.auth?.userId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function meHandler(req, res, next) {
  try {
    const result = await getCurrentUser(req.auth?.userId);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}
