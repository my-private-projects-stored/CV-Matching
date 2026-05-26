import { Router } from "express";
import {
  clearAllApiKeysHandler,
  deleteApiKeyHandler,
  getCompanyProfileConfigHandler,
  getApiKeyStatusHandler,
  getFeatureConfigHandler,
  getLanguageConfigHandler,
  getLlmConfigHandler,
  getLlmEventsHandler,
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
const requireAdminRole = [requireAuth, requireRoles("admin")];

router.get("/language", getLanguageConfigHandler);
router.get("/company-profile", requireAuth, getCompanyProfileConfigHandler);

router.get("/llm-api-key", ...requireAdminRole, getLlmConfigHandler);
router.put("/llm-api-key", ...requireAdminRole, updateLlmConfigHandler);
router.post("/llm-test", ...requireAdminRole, testLlmConfigHandler);

router.get("/privacy", ...requireAdminRole, getPrivacyConfigHandler);
router.put("/privacy", ...requireAdminRole, updatePrivacyConfigHandler);

router.get("/features", ...requireAdminRole, getFeatureConfigHandler);
router.put("/features", ...requireAdminRole, updateFeatureConfigHandler);

router.put("/company-profile", ...requireRecruiterRole, updateCompanyProfileConfigHandler);
router.put("/language", ...requireAdminRole, updateLanguageConfigHandler);

router.get("/prompts", ...requireAdminRole, getPromptConfigHandler);
router.put("/prompts", ...requireAdminRole, updatePromptConfigHandler);

router.get("/api-keys", ...requireAdminRole, getApiKeyStatusHandler);
router.post("/api-keys", ...requireAdminRole, updateApiKeysHandler);
router.delete("/api-keys/:provider", ...requireAdminRole, deleteApiKeyHandler);
router.delete("/api-keys", ...requireAdminRole, clearAllApiKeysHandler);

router.post("/reset", ...requireAdminRole, resetDatabaseHandler);

router.get("/llm-events", ...requireAdminRole, getLlmEventsHandler);

export default router;
