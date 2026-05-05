import express from "express";
import cors from "cors";

import apiRoutes from "./routes/index.js";

const app = express();

// Development-friendly CORS: allow frontend dev server origins.
// In production the gateway should be configured with stricter origins.
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, server-side)
      if (!origin) return callback(null, true);
      // Accept localhost frontends commonly used in development
      try {
        const host = new URL(origin).host;
        if (/localhost(:\d+)?$/.test(host) || host.startsWith('127.0.0.1')) {
          return callback(null, true);
        }
      } catch (e) {
        // ignore and allow
        return callback(null, true);
      }
      // Fallback: allow to ease local development
      return callback(null, true);
    },
    credentials: true,
  })
);

function normalizeErrorCode(rawCode, status) {
  if (typeof rawCode === "string" && rawCode.trim()) {
    return rawCode
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  }

  return status >= 500 ? "internal_server_error" : "request_error";
}

app.use(express.json());
app.use("/api", apiRoutes);

app.use((err, _req, res, _next) => {
  const isMulterFileTooLarge = err?.name === "MulterError" && err?.code === "LIMIT_FILE_SIZE";
  const status = isMulterFileTooLarge ? 413 : err.statusCode || 500;
  const message = err.message || "Internal server error";
  const errorCode = normalizeErrorCode(
    isMulterFileTooLarge ? "uploaded_file_too_large" : err.error_code || err.code,
    status
  );

  res.status(status).json({ message, error_code: errorCode });
});

export default app;
