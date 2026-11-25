import express from "express";
import { requireAuth } from "../middleware/auth-context.js";

const REFRESH_COOKIE_NAME = "cvm_refresh_token";

function isHttpsRequest(req) {
  return Boolean(
    req?.secure ||
      String(req?.headers?.["x-forwarded-proto"] || "").toLowerCase() === "https" ||
      process.env.COOKIE_SECURE === "true"
  );
}

function setRefreshCookie(req, res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isHttpsRequest(req),
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 7 * 86400 * 1000,
  });
}

function clearRefreshCookie(req, res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isHttpsRequest(req),
    sameSite: "strict",
    path: "/api/auth",
  });
}

export function createAuthRoutes(authService) {
  const router = express.Router();

  async function handleSignup(req, res, next) {
    try {
      const result = await authService.signup(req.body || {});
      setRefreshCookie(req, res, result.refresh_token);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  router.post("/signup", handleSignup);
  router.post("/register", handleSignup);

  router.post("/login", async (req, res, next) => {
    try {
      const result = await authService.login(req.body || {});
      setRefreshCookie(req, res, result.refresh_token);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/refresh", async (req, res, next) => {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refresh_token;
      const result = await authService.refresh({ refreshToken });
      setRefreshCookie(req, res, result.refresh_token);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", async (req, res, next) => {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refresh_token;
      await authService.logout({
        accessJti: req.auth?.jti || null,
        refreshToken,
        userId: req.auth?.id || null,
      });
      clearRefreshCookie(req, res);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/change-password", requireAuth, async (req, res, next) => {
    try {
      const result = await authService.changePassword({
        userId: req.auth.id,
        currentPassword: req.body?.currentPassword || req.body?.current_password,
        newPassword: req.body?.newPassword || req.body?.new_password,
      });
      clearRefreshCookie(req, res);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/forgot-password", async (req, res, next) => {
    try {
      const result = await authService.forgotPassword({ email: req.body?.email });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/reset-password", async (req, res, next) => {
    try {
      const result = await authService.resetPassword({
        token: req.body?.token,
        newPassword: req.body?.newPassword || req.body?.new_password,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", requireAuth, async (req, res, next) => {
    try {
      const user = await authService.getMe({ userId: req.auth.id });
      res.json({ user });
    } catch (error) {
      next(error);
    }
  });

  router.put("/profile", requireAuth, async (req, res, next) => {
    try {
      const user = await authService.updateMe({
        userId: req.auth.id,
        name: req.body?.name || req.body?.full_name || req.body?.fullName,
      });
      res.json({ user });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
