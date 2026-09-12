import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorPayloadSchema } from "@banorte/contracts";
import {
  SupabaseAuthenticationError,
  signInWithPassword,
} from "@/features/auth/server/supabase-session";
import { clearSessionCookies, writeSessionCookies } from "@/features/auth/server/session-cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUTH_REQUEST_BYTES = 4_096;
const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(256),
}).strict();

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
