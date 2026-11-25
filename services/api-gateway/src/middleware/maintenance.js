import { PUBSUB_CHANNELS, ROLES, hasAnyRole } from "@cvm/shared";

const DEFAULT_MODULES = {
  auth: false,
  resumes: false,
  jobs: false,
  applications: false,
  recommendations: false,
  enrichment: false,
  notifications: false,
};

const BYPASS_PATHS = new Set([
  "/api/health",
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/auth/logout",
]);

function resolveModuleFromPath(path) {
  if (path.startsWith("/api/resumes")) return "resumes";
  if (path.startsWith("/api/jobs") || path.startsWith("/api/company")) return "jobs";
  if (path.startsWith("/api/applications")) return "applications";
  if (path.startsWith("/api/recommendations") || path.startsWith("/api/vector")) return "recommendations";
  if (path.startsWith("/api/interview")) return "enrichment";
  if (path.startsWith("/api/notifications")) return "notifications";
  if (
    path.startsWith("/api/auth") ||
    path.startsWith("/api/users") ||
    path.startsWith("/api/candidate-profile")
  ) {
    return "auth";
  }
  return null;
}

/**
 * Live maintenance-mode gate listening to Redis CONFIG_UPDATED events.
 * Allows tech_staff (and legacy admin alias) to bypass maintenance for operations.
 */
export function createMaintenanceGuard({ initialConfig = {}, subscriberClient = null } = {}) {
  const state = {
    global: Boolean(initialConfig.global),
    modules: {
      ...DEFAULT_MODULES,
      ...(initialConfig.modules || {}),
    },
  };

  function updateConfig(payload) {
    if (!payload || typeof payload !== "object") return;
    const mode = payload.maintenanceMode !== undefined ? payload.maintenanceMode : payload;

    if (typeof mode === "boolean") {
      state.global = mode;
      return;
    }

    if (mode && typeof mode === "object") {
      if (mode.global !== undefined) {
        state.global = Boolean(mode.global);
      }
      const modulesPatch = mode.modules && typeof mode.modules === "object" ? mode.modules : mode;
      for (const key of Object.keys(DEFAULT_MODULES)) {
        if (modulesPatch[key] !== undefined) {
          state.modules[key] = Boolean(modulesPatch[key]);
        }
      }
    }
  }

  if (subscriberClient && typeof subscriberClient.subscribe === "function") {
    subscriberClient.subscribe(PUBSUB_CHANNELS.CONFIG_UPDATED).catch(() => {});
    subscriberClient.on("message", (channel, rawMessage) => {
      if (channel !== PUBSUB_CHANNELS.CONFIG_UPDATED) return;
      try {
        const parsed = JSON.parse(rawMessage);
        updateConfig(parsed);
      } catch {
        // Ignore malformed pubsub payload
      }
    });
  }

  function middleware(req, res, next) {
    const path = (req.originalUrl || req.url || "").split("?")[0];
    if (BYPASS_PATHS.has(path)) {
      return next();
    }

    if (req.auth?.role && hasAnyRole(req.auth.role, [ROLES.TECH_STAFF])) {
      return next();
    }

    const moduleName = resolveModuleFromPath(path);
    const isGlobalBlocked = state.global;
    const isModuleBlocked = Boolean(moduleName && state.modules[moduleName]);

    if (isGlobalBlocked || isModuleBlocked) {
      return res.status(503).json({
        message: "Hệ thống đang bảo trì phân hệ này, vui lòng thử lại sau.",
        error_code: "service_in_maintenance",
        module: isGlobalBlocked ? "global" : moduleName,
        ...(req.requestId ? { request_id: req.requestId } : {}),
      });
    }

    return next();
  }

  return {
    middleware,
    updateConfig,
    getState: () => ({
      global: state.global,
      modules: { ...state.modules },
    }),
  };
}
