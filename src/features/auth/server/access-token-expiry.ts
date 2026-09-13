const DEFAULT_REFRESH_WINDOW_MS = 60_000;

/**
 * Supabase access tokens are JWTs. This helper only reads the public `exp`
 * claim to decide whether the server should rotate the HttpOnly session; it
 * never treats the decoded payload as proof of identity.
 */
export function accessTokenNeedsRefresh(
  token: string,
  now = Date.now(),
  refreshWindowMs = DEFAULT_REFRESH_WINDOW_MS,
): boolean {
  const payload = token.split(".")[1];
  if (!payload) return true;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    if (!isRecord(decoded) || typeof decoded.exp !== "number" || !Number.isFinite(decoded.exp)) return true;
    return decoded.exp * 1_000 <= now + refreshWindowMs;
  } catch {
    return true;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
