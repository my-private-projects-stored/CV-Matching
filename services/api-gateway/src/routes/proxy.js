import { createProxyMiddleware } from "http-proxy-middleware";

const ENRICHMENT_RESUME_SUBPATH_RE =
  /^\/api\/resumes\/[^/]+\/(generate-cover-letter|generate-outreach|jd-match)(\/|$)/;

function stripQuery(url = "") {
  return String(url).split("?")[0];
}

function isEnrichmentResumePath(req) {
  const path = stripQuery(req.originalUrl || req.url);
  if (path === "/api/resumes/improve" || path.startsWith("/api/resumes/improve/")) {
    return true;
  }
  return ENRICHMENT_RESUME_SUBPATH_RE.test(path);
}

function buildProxy(target, pathFilter) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathFilter,
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.requestId) {
          proxyReq.setHeader("x-request-id", req.requestId);
        }
      },
      error: (err, req, res) => {
        if (res.headersSent) return;
        res.status(502).json({
          message: `Upstream service unavailable: ${err?.message || "proxy error"}`,
          error_code: "upstream_unavailable",
          ...(req.requestId ? { request_id: req.requestId } : {}),
        });
      },
    },
  });
}

/**
 * 100% Microservices Reverse Proxy Table (Strangler Fig complete — zero legacy monolith).
 */
export function registerProxyRoutes(app, targets) {
  // 1. Resume LLM enrichment sub-paths -> ai-enrichment-service (5006)
  app.use(buildProxy(targets.aiEnrichmentService, (_pathname, req) => isEnrichmentResumePath(req)));

  // 2. Auth, Users, Candidate Profile -> auth-service (5001)
  app.use(
    buildProxy(targets.authService, ["/api/auth", "/api/users", "/api/candidate-profile"])
  );

  // 3. Core Resume CRUD/Upload/Download/Builder -> resume-service (5002)
  app.use(buildProxy(targets.resumeService, ["/api/resumes"]));

  // 4. Company & Jobs -> job-service (5003)
  app.use(buildProxy(targets.jobService, ["/api/company", "/api/jobs"]));

  // 5. Applications -> application-service (5004)
  app.use(buildProxy(targets.applicationService, ["/api/applications"]));

  // 6. Recommendations & Vector Search -> recommendation-service (5005)
  app.use(buildProxy(targets.recommendationService, ["/api/recommendations", "/api/vectors"]));

  // 7. AI Enrichment & Interviews -> ai-enrichment-service (5006)
  app.use(buildProxy(targets.aiEnrichmentService, ["/api/enrichment", "/api/interviews"]));

  // 8. Notifications & SSE Stream -> notification-service (5007)
  app.use(buildProxy(targets.notificationService, ["/api/notifications"]));

  // 9. Config, Status, Ops & Owner Analytics -> config-analytics-service (5008)
  app.use(
    buildProxy(targets.configAnalyticsService, [
      "/api/config",
      "/api/status",
      "/api/config-analytics",
      "/api/admin",
      "/api/owner",
    ])
  );
}
