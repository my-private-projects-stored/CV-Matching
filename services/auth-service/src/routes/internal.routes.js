import express from "express";
import { requireInternalToken } from "../middleware/auth-context.js";

export function createInternalRoutes(authService, internalToken) {
  const router = express.Router();
  router.use(requireInternalToken(internalToken));

  router.get("/users/:id", async (req, res, next) => {
    try {
      const user = await authService.getMe({ userId: req.params.id });
      res.json({ user });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
