import "server-only";

import { z } from "zod";
import {
  requestSupabaseSession,
  SupabaseAuthenticationError,
  type SupabaseUserSession,
} from "./supabase-session-request";

export { SupabaseAuthenticationError, type SupabaseUserSession } from "./supabase-session-request";

const supabaseUrlSchema = z.string().url().transform((value, context) => {
  const url = new URL(value);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Supabase requiere HTTPS" });
    return z.NEVER;
  }
  if (url.username || url.password || url.hash) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "La URL de Supabase no es segura" });
    return z.NEVER;
  }
  return url;
});

export async function signInWithPassword(
  email: string,
  password: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<SupabaseUserSession> {
  return requestConfiguredSession(
    "password",
    { email, password },
    fetchImplementation,
  );
}

export async function refreshSupabaseSession(
  refreshToken: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<SupabaseUserSession> {
  return requestConfiguredSession(
    "refresh_token",
    { refresh_token: refreshToken },
    fetchImplementation,
  );
}

async function requestConfiguredSession(
  grantType: "password" | "refresh_token",
  body: Record<string, string>,
  fetchImplementation: typeof fetch,
): Promise<SupabaseUserSession> {
  const config = readSupabaseAuthConfig();
  if (!config) throw new SupabaseAuthenticationError("configuration");

  return requestSupabaseSession(config, grantType, body, fetchImplementation);
}

function readSupabaseAuthConfig() {
  const url = supabaseUrlSchema.safeParse(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const publishableKey = (
    process.env.SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )?.trim();
  if (!url.success || !publishableKey || publishableKey.length < 20 || publishableKey.length > 8_192) return null;
  return { url: url.data, publishableKey };
}
