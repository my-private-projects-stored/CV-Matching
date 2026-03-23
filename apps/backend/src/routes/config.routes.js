import { Router } from "express";

import {
  clearAllApiKeysHandler,
  deleteApiKeyHandler,
  getCompanyProfileConfigHandler,
  getApiKeyStatusHandler,
  getFeatureConfigHandler,
  getLanguageConfigHandler,
  getLlmConfigHandler,
  getPromptConfigHandler,
  resetDatabaseHandler,
  testLlmConfigHandler,
  updateApiKeysHandler,
  updateCompanyProfileConfigHandler,
  updateFeatureConfigHandler,
  updateLanguageConfigHandler,
  updateLlmConfigHandler,
  updatePromptConfigHandler,
} from "../controllers/config.controller.js";

const router = Router();

router.get("/llm-api-key", getLlmConfigHandler);
router.put("/llm-api-key", updateLlmConfigHandler);
router.post("/llm-test", testLlmConfigHandler);

router.get("/features", getFeatureConfigHandler);
router.put("/features", updateFeatureConfigHandler);

router.get("/company-profile", getCompanyProfileConfigHandler);
router.put("/company-profile", updateCompanyProfileConfigHandler);

router.get("/language", getLanguageConfigHandler);
router.put("/language", updateLanguageConfigHandler);

router.get("/prompts", getPromptConfigHandler);
router.put("/prompts", updatePromptConfigHandler);

router.get("/api-keys", getApiKeyStatusHandler);
router.post("/api-keys", updateApiKeysHandler);
router.delete("/api-keys/:provider", deleteApiKeyHandler);
router.delete("/api-keys", clearAllApiKeysHandler);

router.post("/reset", resetDatabaseHandler);

export default router;
