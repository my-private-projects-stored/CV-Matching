import crypto from "node:crypto";

/**
 * Propagate or generate x-request-id for distributed request tracing.
 */
export function correlationMiddleware(req, res, next) {
  const incoming = String(req.headers?.["x-request-id"] || "").trim();
  const requestId = incoming || crypto.randomUUID();
  req.requestId = requestId;
  if (typeof res?.setHeader === "function") {
    res.setHeader("x-request-id", requestId);
  }
  next();
}
