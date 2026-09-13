import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readSessionCookies } from "@/features/auth/server/session-cookies";
import { readAgentApiConfig } from "@/features/agent/server/agent-api-config";
import { sessionUiSnapshotSchema } from "@/features/agent/session/session-ui-snapshot";
import { accessTokenNeedsRefresh } from "@/features/auth/server/access-token-expiry";
import { clearSessionCookies, writeSessionCookies } from "@/features/auth/server/session-cookies";
import { refreshSupabaseSession, SupabaseAuthenticationError, type SupabaseUserSession } from "@/features/auth/server/supabase-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const cookies = readSessionCookies(request);
  let accessToken = cookies.accessToken;
  let refreshedSession: SupabaseUserSession | undefined;
  if (cookies.refreshToken && (!accessToken || accessTokenNeedsRefresh(accessToken))) {
    try {
      refreshedSession = await refreshSupabaseSession(cookies.refreshToken);
      accessToken = refreshedSession.accessToken;
    } catch (error) {
      return refreshFailure(error);
    }
  }
  if (!accessToken) return Response.json({ code: "authentication_required" }, { status: 401, headers });
  const config = readAgentApiConfig();
  if (!config) return Response.json({ code: "snapshot_unavailable" }, { status: 503, headers });
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 1024) return Response.json({ code: "invalid_request" }, { status: 400, headers });
  let input: { sessionId: string };
  try { input = z.object({ sessionId: z.string().uuid() }).strict().parse(JSON.parse(body)); }
  catch { return Response.json({ code: "invalid_request" }, { status: 400, headers }); }
  try {
    const endpoint = new URL(config.endpoint);
    endpoint.pathname = endpoint.pathname.replace(/\/$/u, "") + "/snapshot";
    endpoint.search = "";
    const fetchSnapshot = (token: string) => fetch(endpoint, {
      method: "POST", cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
    let upstream = await fetchSnapshot(accessToken);
    if (upstream.status === 401 && cookies.refreshToken && !refreshedSession) {
      try {
        refreshedSession = await refreshSupabaseSession(cookies.refreshToken);
        upstream = await fetchSnapshot(refreshedSession.accessToken);
      } catch (error) {
        return refreshFailure(error);
      }
    }
    if (upstream.status === 401) {
      const response = NextResponse.json({ code: "authentication_required" }, { status: 401, headers });
      clearSessionCookies(response);
      return response;
    }
    if (!upstream.ok) return Response.json({ code: "snapshot_unavailable" }, { status: upstream.status === 409 ? 409 : 503, headers });
    const text = await upstream.text();
    if (new TextEncoder().encode(text).byteLength > 1_000_000) throw new Error("Snapshot demasiado grande");
    const snapshot = sessionUiSnapshotSchema.parse(JSON.parse(text));
    if (snapshot.sessionId !== input.sessionId) throw new Error("Snapshot ajeno");
    const response = NextResponse.json(snapshot, { headers });
    if (refreshedSession) writeSessionCookies(response, refreshedSession);
    return response;
  } catch { return Response.json({ code: "snapshot_unavailable" }, { status: 503, headers }); }
}

function refreshFailure(error: unknown) {
  const unavailable = error instanceof SupabaseAuthenticationError && error.code === "unavailable";
  const response = NextResponse.json({ code: unavailable ? "authentication_unavailable" : "authentication_required" }, {
    status: unavailable ? 503 : 401, headers,
  });
  if (!unavailable) clearSessionCookies(response);
  return response;
}
