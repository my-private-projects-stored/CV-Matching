import { Router } from "express";

import {
  clearAllApiKeysHandler,
  deleteApiKeyHandler,
  getCompanyProfileConfigHandler,
  getApiKeyStatusHandler,
  getFeatureConfigHandler,
  getLanguageConfigHandler,
  getLlmConfigHandler,
  getPrivacyConfigHandler,
  getPromptConfigHandler,
  resetDatabaseHandler,
  testLlmConfigHandler,
  updateApiKeysHandler,
  updateCompanyProfileConfigHandler,
  updateFeatureConfigHandler,
  updateLanguageConfigHandler,
  updateLlmConfigHandler,
  updatePrivacyConfigHandler,
  updatePromptConfigHandler,
} from "../controllers/config.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.middleware.js";

const router = Router();
const requireRecruiterRole = [requireAuth, requireRoles("recruiter", "admin")];

router.get("/language", getLanguageConfigHandler);
router.get("/company-profile", requireAuth, getCompanyProfileConfigHandler);

router.use(...requireRecruiterRole);

router.get("/llm-api-key", getLlmConfigHandler);
router.put("/llm-api-key", updateLlmConfigHandler);
router.post("/llm-test", testLlmConfigHandler);

router.get("/privacy", getPrivacyConfigHandler);
router.put("/privacy", updatePrivacyConfigHandler);

router.get("/features", getFeatureConfigHandler);
router.put("/features", updateFeatureConfigHandler);

router.put("/company-profile", updateCompanyProfileConfigHandler);
router.put("/language", updateLanguageConfigHandler);

router.get("/prompts", getPromptConfigHandler);
router.put("/prompts", updatePromptConfigHandler);

router.get("/api-keys", getApiKeyStatusHandler);
router.post("/api-keys", updateApiKeysHandler);
router.delete("/api-keys/:provider", deleteApiKeyHandler);
router.delete("/api-keys", clearAllApiKeysHandler);

router.post("/reset", resetDatabaseHandler);

export default router;
