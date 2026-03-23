import {
  clearAllApiKeys,
  deleteApiKey,
  getCompanyProfileConfig,
  getFeatureConfig,
  getApiKeyStatus,
  getLanguageConfig,
  getLlmConfig,
  getPromptConfig,
  getSystemStatus,
  resetDatabase,
  testLlmConfig,
  updateApiKeys,
  updateCompanyProfileConfig,
  updateFeatureConfig,
  updateLanguageConfig,
  updateLlmConfig,
  updatePromptConfig,
} from "../services/config.service.js";

export async function getLlmConfigHandler(_req, res, next) {
  try {
    const config = await getLlmConfig();
    return res.status(200).json(config);
  } catch (error) {
    return next(error);
  }
}

export async function updateLlmConfigHandler(req, res, next) {
  try {
    const config = await updateLlmConfig(req.body || {});
    return res.status(200).json(config);
  } catch (error) {
    return next(error);
  }
}

export async function testLlmConfigHandler(req, res, next) {
  try {
    const result = await testLlmConfig(req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function getFeatureConfigHandler(_req, res, next) {
  try {
    const config = await getFeatureConfig();
    return res.status(200).json(config);
  } catch (error) {
    return next(error);
  }
}

export async function updateFeatureConfigHandler(req, res, next) {
  try {
    const config = await updateFeatureConfig(req.body || {});
    return res.status(200).json(config);
  } catch (error) {
    return next(error);
  }
}

export async function getCompanyProfileConfigHandler(_req, res, next) {
  try {
    const config = await getCompanyProfileConfig();
    return res.status(200).json(config);
  } catch (error) {
    return next(error);
  }
}

export async function updateCompanyProfileConfigHandler(req, res, next) {
  try {
    const config = await updateCompanyProfileConfig(req.body || {});
    return res.status(200).json(config);
  } catch (error) {
    return next(error);
  }
}

export async function getLanguageConfigHandler(_req, res, next) {
  try {
    const config = await getLanguageConfig();
    return res.status(200).json(config);
  } catch (error) {
    return next(error);
  }
}

export async function updateLanguageConfigHandler(req, res, next) {
  try {
    const config = await updateLanguageConfig(req.body || {});
    return res.status(200).json(config);
  } catch (error) {
    return next(error);
  }
}

export async function getPromptConfigHandler(_req, res, next) {
  try {
    const config = await getPromptConfig();
    return res.status(200).json(config);
  } catch (error) {
    return next(error);
  }
}

export async function updatePromptConfigHandler(req, res, next) {
  try {
    const config = await updatePromptConfig(req.body || {});
    return res.status(200).json(config);
  } catch (error) {
    return next(error);
  }
}

export async function getApiKeyStatusHandler(_req, res, next) {
  try {
    const status = await getApiKeyStatus();
    return res.status(200).json(status);
  } catch (error) {
    return next(error);
  }
}

export async function updateApiKeysHandler(req, res, next) {
  try {
    const result = await updateApiKeys(req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function deleteApiKeyHandler(req, res, next) {
  try {
    await deleteApiKey(req.params.provider);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

export async function clearAllApiKeysHandler(req, res, next) {
  try {
    await clearAllApiKeys(req.query.confirm);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

export async function resetDatabaseHandler(req, res, next) {
  try {
    const result = await resetDatabase(req.body?.confirm);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function getSystemStatusHandler(_req, res, next) {
  try {
    const status = await getSystemStatus();
    return res.status(200).json(status);
  } catch (error) {
    return next(error);
  }
}
