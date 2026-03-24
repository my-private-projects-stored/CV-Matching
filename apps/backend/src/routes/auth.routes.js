import { Router } from "express";

import {
  changePasswordHandler,
  forgotPasswordHandler,
  loginHandler,
  meHandler,
  resetPasswordHandler,
  signupHandler,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/signup", signupHandler);
router.post("/login", loginHandler);
router.post("/forgot-password", forgotPasswordHandler);
router.post("/reset-password", resetPasswordHandler);
router.post("/change-password", requireAuth, changePasswordHandler);
router.get("/me", requireAuth, meHandler);

export default router;
