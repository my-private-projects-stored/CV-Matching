import express from "express";
import { ROLES, createHttpError } from "@cvm/shared";
import { requireAuth, requireRole } from "../middleware/auth-context.js";

const API_KEY_PROVIDERS = ["openai", "anthropic", "google", "openrouter", "deepseek"];

function formatApiKeysResponse(raw = {}) {
  const providers = API_KEY_PROVIDERS.map((provider) => {
    const val = String(raw[provider] || "").trim();
    return {
      provider,
      configured: Boolean(val),
      masked_key: val ? `***${val.slice(-4)}` : null,
    };
  });
  return { ...raw, providers };
}

export function createConfigRoutes(configService, { listLlmEvents = null } = {}) {
  const router = express.Router();

  router.get("/language", async (_req, res, next) => {
    try {
      const value = await configService.getConfig("languageConfig");
      res.json(value);
    } catch (error) {
      next(error);
    }
  });

  router.get("/all", requireAuth, requireRole(ROLES.TECH_STAFF), async (_req, res, next) => {
    try {
      res.json(await configService.getAllConfigs());
    } catch (error) {
      next(error);
    }
  });

  router.post("/llm-test", requireAuth, requireRole(ROLES.TECH_STAFF, ROLES.RECRUITER), async (req, res, next) => {
    try {
      const [current, apiKeys] = await Promise.all([
        configService.getConfig("llmConfig"),
        configService.getConfig("apiKeysConfig"),
      ]);
      const provider = String(req.body?.provider || current?.provider || process.env.LLM_PROVIDER || "ollama")
        .trim()
        .toLowerCase();
      const model = String(
        req.body?.model ||
          current?.model ||
          (provider === "ollama" ? process.env.OLLAMA_MODEL || "gemma3:4b" : process.env.GEMINI_MODEL || "gemini-2.5-flash")
      ).trim();

      if (provider === "ollama") {
        const baseUrl = String(
          req.body?.api_base || current?.api_base || process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434"
        )
          .trim()
          .replace(/\/+$/, "");
        try {
          const r = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(8000) });
          if (!r.ok) {
            return res.json({ healthy: false, provider, model, error: `Ollama HTTP ${r.status}` });
          }
          const body = await r.json().catch(() => ({}));
          const models = (body?.models || []).map((m) => m.name || m.model);
          return res.json({
            healthy: true,
            provider,
            model,
            response_model: model,
            model_output: `Ollama connected (${models.join(", ") || "no models"})`,
          });
        } catch (err) {
          return res.json({
            healthy: false,
            provider,
            model,
            error: String(err?.message || "Ollama unreachable"),
          });
        }
      }

      if (provider === "gemini") {
        const apiKey = String(req.body?.api_key || current?.api_key || apiKeys?.google || process.env.GEMINI_API_KEY || "").trim();
        if (!apiKey) {
          return res.json({
            healthy: false,
            provider,
            model,
            warning: "No Gemini API key configured; system will use deterministic template_fallback.",
          });
        }
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
            model
          )}:generateContent?key=${encodeURIComponent(apiKey)}`;
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(12000),
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply OK" }] }] }),
          });
          if (!r.ok) {
            const errBody = await r.json().catch(() => null);
            return res.json({
              healthy: false,
              provider,
              model,
              error: String(errBody?.error?.message || `Gemini HTTP ${r.status}`),
            });
          }
          const body = await r.json().catch(() => null);
          const out = (body?.candidates?.[0]?.content?.parts || []).map((p) => p?.text || "").join("");
          return res.json({ healthy: true, provider, model, response_model: model, model_output: out });
        } catch (err) {
          return res.json({
            healthy: false,
            provider,
            model,
            error: String(err?.message || "Gemini request failed"),
          });
        }
      }

      const apiKey = String(req.body?.api_key || current?.api_key || "").trim();
      return res.json({
        healthy: Boolean(apiKey),
        provider,
        model,
        ...(apiKey ? {} : { warning: "No LLM API key configured; system will use deterministic template_fallback." }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/llm-events", requireAuth, requireRole(ROLES.TECH_STAFF, ROLES.PLATFORM_OWNER), async (req, res, next) => {
    try {
      if (typeof listLlmEvents === "function") {
        const events = await listLlmEvents({
          feature: req.query?.feature ? String(req.query.feature) : null,
          generation_mode: req.query?.generation_mode ? String(req.query.generation_mode) : null,
          limit: Number(req.query?.limit) || 50,
        });
        return res.json({ data: events, count: events.length });
      }
      return res.json({ data: [], count: 0 });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/reset", requireAuth, requireRole(ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      if (req.body?.confirm !== "RESET_ALL_DATA") {
        throw createHttpError(400, "Confirmation token RESET_ALL_DATA is required", "invalid_reset_confirm");
      }
      res.json({ ok: true, message: "System configuration reset acknowledged" });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api-keys", requireAuth, requireRole(ROLES.TECH_STAFF, ROLES.RECRUITER), async (_req, res, next) => {
    try {
      const raw = await configService.getConfig("apiKeysConfig");
      res.json(formatApiKeysResponse(raw));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api-keys", requireAuth, requireRole(ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const current = await configService.getConfig("apiKeysConfig");
      const nextVal = { ...current };
      const updatedProviders = [];
      for (const p of API_KEY_PROVIDERS) {
        if (req.body?.[p] !== undefined) {
          nextVal[p] = String(req.body[p] || "").trim();
          updatedProviders.push(p);
        }
      }
      await configService.updateConfig({
        key: "apiKeysConfig",
        value: nextVal,
        actor: req.auth,
        reason: "API keys updated",
        requestId: req.requestId || "",
      });
      res.json({ message: "API keys updated", updated_providers: updatedProviders });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api-keys/:provider", requireAuth, requireRole(ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const provider = String(req.params.provider || "").trim().toLowerCase();
      if (!API_KEY_PROVIDERS.includes(provider)) {
        throw createHttpError(400, "Unknown API key provider", "invalid_provider");
      }
      const current = await configService.getConfig("apiKeysConfig");
      const nextVal = { ...current, [provider]: "" };
      await configService.updateConfig({
        key: "apiKeysConfig",
        value: nextVal,
        actor: req.auth,
        reason: `Cleared API key for ${provider}`,
        requestId: req.requestId || "",
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api-keys", requireAuth, requireRole(ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      if (req.query?.confirm !== "CLEAR_ALL_KEYS") {
        throw createHttpError(400, "confirm=CLEAR_ALL_KEYS is required", "invalid_confirm");
      }
      const cleared = Object.fromEntries(API_KEY_PROVIDERS.map((p) => [p, ""]));
      await configService.updateConfig({
        key: "apiKeysConfig",
        value: cleared,
        actor: req.auth,
        reason: "Cleared all API keys",
        requestId: req.requestId || "",
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  const keyRouteMap = [
    ["features", "featureConfig", [ROLES.CANDIDATE, ROLES.RECRUITER, ROLES.TECH_STAFF, ROLES.PLATFORM_OWNER]],
    ["language", "languageConfig", [ROLES.CANDIDATE, ROLES.RECRUITER, ROLES.TECH_STAFF, ROLES.PLATFORM_OWNER]],
    ["llm-api-key", "llmConfig", [ROLES.TECH_STAFF, ROLES.RECRUITER]],
    ["prompts", "promptConfig", [ROLES.CANDIDATE, ROLES.RECRUITER, ROLES.TECH_STAFF]],
    ["company-profile", "companyProfileConfig", [ROLES.TECH_STAFF, ROLES.RECRUITER]],
    ["privacy", "privacyConfig", [ROLES.CANDIDATE, ROLES.RECRUITER, ROLES.TECH_STAFF, ROLES.PLATFORM_OWNER]],
    ["scoring-weights", "scoringWeights", [ROLES.TECH_STAFF, ROLES.RECRUITER]],
    ["maintenance", "maintenanceMode", [ROLES.TECH_STAFF, ROLES.RECRUITER]],
  ];

  for (const [pathSegment, configKey, readRoles] of keyRouteMap) {
    if (pathSegment !== "language") {
      router.get(`/${pathSegment}`, requireAuth, requireRole(...readRoles), async (_req, res, next) => {
        try {
          res.json(await configService.getConfig(configKey));
        } catch (error) {
          next(error);
        }
      });
    }

    router.put(`/${pathSegment}`, requireAuth, requireRole(ROLES.TECH_STAFF), async (req, res, next) => {
      try {
        const result = await configService.updateConfig({
          key: configKey,
          value: req.body || {},
          actor: req.auth,
          reason: req.body?.reason || "",
          requestId: req.requestId || "",
        });
        res.json({
          ...(result.value && typeof result.value === "object" ? result.value : {}),
          ...result,
        });
      } catch (error) {
        next(error);
      }
    });
  }

  return router;
}
