/**
 * Error helpers. Nothing in the app may swallow a failure silently: every
 * `catch` either propagates, or logs through `logError` and surfaces a message
 * to the user.
 */

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

/** Logs with a stable `[scope]` prefix and returns the human-readable message. */
export function logError(scope: string, error: unknown, context?: Record<string, unknown>): string {
  const message = errorMessage(error);
  if (context) console.error(`[${scope}] ${message}`, error, context);
  else console.error(`[${scope}] ${message}`, error);
  return message;
}

/** True when a storage write failed because the quota is exhausted. */
export function isQuotaExceeded(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22)
  );
}
