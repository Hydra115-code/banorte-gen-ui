import { z } from "zod";

const authSessionSchema = z.object({
  access_token: z.string().min(20).max(8_192),
  refresh_token: z.string().min(1).max(8_192),
  expires_in: z.number().int().positive().max(86_400),
  user: z.object({ id: z.string().uuid() }).passthrough(),
}).passthrough();

export interface SupabaseUserSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
}

export interface SupabaseAuthRequestConfig {
  url: URL;
  publishableKey: string;
}

export class SupabaseAuthenticationError extends Error {
  readonly code: "configuration" | "invalid_credentials" | "unavailable";

  constructor(code: "configuration" | "invalid_credentials" | "unavailable") {
    super(code === "invalid_credentials" ? "Las credenciales no son válidas" : "No fue posible autenticar la sesión");
    this.name = "SupabaseAuthenticationError";
    this.code = code;
  }
}

export async function requestSupabaseSession(
  config: SupabaseAuthRequestConfig,
  grantType: "password" | "refresh_token",
  body: Record<string, string>,
  fetchImplementation: typeof fetch = fetch,
): Promise<SupabaseUserSession> {
  const endpoint = new URL("/auth/v1/token", config.url);
  endpoint.searchParams.set("grant_type", grantType);

  let response: Response;
  try {
    response = await fetchImplementation(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.publishableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new SupabaseAuthenticationError("unavailable");
  }

  if (!response.ok) {
    throw new SupabaseAuthenticationError(response.status === 400 ? "invalid_credentials" : "unavailable");
  }

  const parsed = authSessionSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new SupabaseAuthenticationError("unavailable");

  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    expiresIn: parsed.data.expires_in,
    userId: parsed.data.user.id,
  };
}
