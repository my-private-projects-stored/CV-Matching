type LogMeta = Record<string, unknown>;

function buildPrefix(scope: string): string {
  return `[${scope}]`;
}

function isAccessDeniedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const statusCode = (error as { statusCode?: number }).statusCode;
  if (statusCode === 401 || statusCode === 403) return true;
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('access your own resume') ||
      message.includes('permission') ||
      message.includes('unauthorized')
    );
  }
  return false;
}

export function logError(scope: string, message: string, error?: unknown, meta?: LogMeta): void {
  if (isAccessDeniedError(error)) {
    if (error !== undefined && meta !== undefined) {
      console.warn(`${buildPrefix(scope)} ${message}`, error, meta);
      return;
    }
    if (error !== undefined) {
      console.warn(`${buildPrefix(scope)} ${message}`, error);
      return;
    }
    if (meta !== undefined) {
      console.warn(`${buildPrefix(scope)} ${message}`, meta);
      return;
    }
    console.warn(`${buildPrefix(scope)} ${message}`);
    return;
  }
  if (error !== undefined && meta !== undefined) {
    console.error(`${buildPrefix(scope)} ${message}`, error, meta);
    return;
  }
  if (error !== undefined) {
    console.error(`${buildPrefix(scope)} ${message}`, error);
    return;
  }
  if (meta !== undefined) {
    console.error(`${buildPrefix(scope)} ${message}`, meta);
    return;
  }
  console.error(`${buildPrefix(scope)} ${message}`);
}

export function logWarn(scope: string, message: string, meta?: unknown): void {
  if (meta !== undefined) {
    console.warn(`${buildPrefix(scope)} ${message}`, meta);
    return;
  }
  console.warn(`${buildPrefix(scope)} ${message}`);
}
