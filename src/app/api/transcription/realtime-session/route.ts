import { NextRequest, NextResponse } from "next/server";
import { readSessionCookies } from "@/features/auth/server/session-cookies";
import { accessTokenNeedsRefresh } from "@/features/auth/server/access-token-expiry";
import { clearSessionCookies, writeSessionCookies } from "@/features/auth/server/session-cookies";
import { refreshSupabaseSession, SupabaseAuthenticationError, type SupabaseUserSession } from "@/features/auth/server/supabase-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBackendApiUrl(): string {
  if (process.env.BACKEND_API_URL) {
    return process.env.BACKEND_API_URL.replace(/\/+$/, "");
  }
  if (process.env.AGENT_API_URL) {
    try {
      return new URL(process.env.AGENT_API_URL).origin;
    } catch {
      // Ignorar error de parseo y usar valor por defecto
    }
  }
  return "http://127.0.0.1:3101";
}

export async function POST(request: NextRequest) {
  const cookies = readSessionCookies(request);
  let accessToken = cookies.accessToken;
  let refreshedSession: SupabaseUserSession | undefined;

  if (cookies.refreshToken && (!accessToken || accessTokenNeedsRefresh(accessToken))) {
    try {
      refreshedSession = await refreshSupabaseSession(cookies.refreshToken);
      accessToken = refreshedSession.accessToken;
    } catch (error) {
      return authenticationFailure(error);
    }
  }

  if (!accessToken) {
    return NextResponse.json(
      {
        version: "1",
        code: "authentication_required",
        message: "Usuario no autenticado",
        recoverable: false,
        hasPartialData: false,
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json",
        },
      },
    );
  }

  const backendUrl = getBackendApiUrl();

  try {
    const fetchRealtimeSession = (token: string) => fetch(`${backendUrl}/api/transcription/realtime-session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });

    let response = await fetchRealtimeSession(accessToken);
    if (response.status === 401 && cookies.refreshToken && !refreshedSession) {
      try {
        refreshedSession = await refreshSupabaseSession(cookies.refreshToken);
        response = await fetchRealtimeSession(refreshedSession.accessToken);
      } catch (error) {
        return authenticationFailure(error);
      }
    }
    if (response.status === 401) return authenticationFailure();

    const body = await response.text();

    const result = new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
    if (refreshedSession) writeSessionCookies(result, refreshedSession);
    return result;
  } catch {
    return NextResponse.json(
      {
        version: "1",
        code: "transcription_unavailable",
        message: "No fue posible iniciar la transcripción",
        recoverable: true,
        hasPartialData: false,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json",
        },
      },
    );
  }
}

function authenticationFailure(error?: unknown) {
  const unavailable = error instanceof SupabaseAuthenticationError && error.code === "unavailable";
  const response = NextResponse.json({
    version: "1",
    code: unavailable ? "authentication_unavailable" : "authentication_required",
    message: unavailable ? "No fue posible renovar la sesión" : "La sesión expiró; inicia sesión nuevamente",
    recoverable: unavailable,
    hasPartialData: false,
  }, { status: unavailable ? 503 : 401, headers: { "Cache-Control": "no-store" } });
  if (!unavailable) clearSessionCookies(response);
  return response;
}
