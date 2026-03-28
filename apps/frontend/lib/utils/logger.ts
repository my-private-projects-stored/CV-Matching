type LogMeta = Record<string, unknown>;

function buildPrefix(scope: string): string {
  return `[${scope}]`;
}

export function logError(
  scope: string,
  message: string,
  error?: unknown,
  meta?: LogMeta
): void {
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