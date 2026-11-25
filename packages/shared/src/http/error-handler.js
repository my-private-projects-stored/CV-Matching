/**
 * Create an HTTP error with statusCode and machine-readable errorCode.
 */
export function createHttpError(statusCode, message, errorCode = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (errorCode) {
    error.errorCode = errorCode;
  }
  return error;
}

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

/**
 * Express error-handling middleware returning consistent JSON errors.
 */
export function errorHandlerMiddleware(err, req, res, _next) {
  const isMulterFileTooLarge = err?.name === "MulterError" && err?.code === "LIMIT_FILE_SIZE";
  const status = isMulterFileTooLarge ? 413 : err?.statusCode || 500;
  const message = err?.message || "Internal server error";
  const errorCode = normalizeErrorCode(
    isMulterFileTooLarge ? "uploaded_file_too_large" : err?.errorCode || err?.error_code || err?.code,
    status
  );

  res.status(status).json({
    message,
    error_code: errorCode,
    ...(req?.requestId ? { request_id: req.requestId } : {}),
  });
}
