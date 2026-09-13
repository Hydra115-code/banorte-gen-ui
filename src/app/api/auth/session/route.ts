import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorPayloadSchema } from "@banorte/contracts";
import {
  refreshSupabaseSession,
  SupabaseAuthenticationError,
  signInWithPassword,
  verifySupabaseUser,
} from "@/features/auth/server/supabase-session";
import { clearSessionCookies, readSessionCookies, writeSessionCookies } from "@/features/auth/server/session-cookies";
import { accessTokenNeedsRefresh } from "@/features/auth/server/access-token-expiry";
import { demoLoginAvailable } from "@/features/auth/server/demo-availability";
import { sessionOwnerKey } from "@/features/auth/server/session-owner-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUTH_REQUEST_BYTES = 4_096;
const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(256),
}).strict();

export async function GET(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  const cookies = readSessionCookies(request);
  if (!cookies.accessToken && !cookies.refreshToken) return sessionStatus(false, correlationId);

  try {
    if (cookies.accessToken && !accessTokenNeedsRefresh(cookies.accessToken)) {
      try {
        const userId = await verifySupabaseUser(cookies.accessToken);
        return sessionStatus(true, correlationId, sessionOwnerKey(userId));
      } catch (error) {
        if (!(error instanceof SupabaseAuthenticationError)
          || error.code !== "invalid_credentials"
          || !cookies.refreshToken) throw error;
      }
    }
    if (!cookies.refreshToken) {
      const response = sessionStatus(false, correlationId);
      clearSessionCookies(response);
      return response;
    }
    const session = await refreshSupabaseSession(cookies.refreshToken);
    const response = sessionStatus(true, correlationId, sessionOwnerKey(session.userId));
    writeSessionCookies(response, session);
    return response;
  } catch (error) {
    if (error instanceof SupabaseAuthenticationError && error.code === "invalid_credentials") {
      const response = sessionStatus(false, correlationId);
      clearSessionCookies(response);
      return response;
    }
    return authError(503, "authentication_unavailable", "No fue posible comprobar la sesión", correlationId);
  }
}

export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_AUTH_REQUEST_BYTES) {
    return authError(413, "request_too_large", "La solicitud excede el tamaño permitido", correlationId);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_AUTH_REQUEST_BYTES) {
    return authError(413, "request_too_large", "La solicitud excede el tamaño permitido", correlationId);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return authError(400, "invalid_request", "Solicitud inválida", correlationId);
  }
  const credentials = credentialsSchema.safeParse(body);
  if (!credentials.success) return authError(400, "invalid_request", "Solicitud inválida", correlationId);

  try {
    const session = await signInWithPassword(credentials.data.email, credentials.data.password);
    const response = NextResponse.json({
      authenticated: true,
      expiresAt: new Date(Date.now() + session.expiresIn * 1_000).toISOString(),
    }, { headers: responseHeaders(correlationId) });
    writeSessionCookies(response, session);
    return response;
  } catch (error) {
    const invalidCredentials = error instanceof SupabaseAuthenticationError
      && error.code === "invalid_credentials";
    return authError(
      invalidCredentials ? 401 : 503,
      invalidCredentials ? "authentication_failed" : "authentication_unavailable",
      invalidCredentials ? "Las credenciales no son válidas" : "La autenticación no está disponible",
      correlationId,
    );
  }
}

export async function DELETE() {
  const correlationId = crypto.randomUUID();
  const response = NextResponse.json(
    { authenticated: false },
    { headers: responseHeaders(correlationId) },
  );
  clearSessionCookies(response);
  return response;
}

function sessionStatus(authenticated: boolean, correlationId: string, ownerKey?: string) {
  return NextResponse.json({
    authenticated,
    demoAvailable: demoLoginAvailable(),
    ...(ownerKey ? { ownerKey } : {}),
  }, { headers: responseHeaders(correlationId) });
}

function authError(status: number, code: string, message: string, correlationId: string) {
  return NextResponse.json(errorPayloadSchema.parse({
    version: "1",
    code,
    message,
    recoverable: status >= 500,
    hasPartialData: false,
    correlationId,
  }), { status, headers: responseHeaders(correlationId) });
}

function responseHeaders(correlationId: string) {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Correlation-ID": correlationId,
  };
}
