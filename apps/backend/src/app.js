import express from "express";

import apiRoutes from "./routes/index.js";

const app = express();

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
  const status = err.statusCode || 500;
  const message = err.message || "Internal server error";
  const errorCode = normalizeErrorCode(err.error_code || err.code, status);

  res.status(status).json({ message, error_code: errorCode });
});

export default app;
