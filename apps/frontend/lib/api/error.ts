export type ApiClientError = Error & {
  errorCode?: string;
  statusCode?: number;
};

export function buildApiClientError(
  status: number,
  bodyText: string,
  fallbackMessagePrefix: string
): ApiClientError {
  let parsedMessage = '';
  let parsedCode = '';

  try {
    const parsed = JSON.parse(bodyText) as {
      message?: string;
      detail?: string;
      error_code?: string;
    };
    parsedMessage = String(parsed.message || parsed.detail || '').trim();
    parsedCode = String(parsed.error_code || '').trim();
  } catch {
    parsedMessage = '';
    parsedCode = '';
  }

  const fallback = `${fallbackMessagePrefix} (status ${status}).`;
  const error = new Error(parsedMessage || fallback) as ApiClientError;
  error.statusCode = status;
  if (parsedCode) {
    error.errorCode = parsedCode;
  }
  return error;
}
