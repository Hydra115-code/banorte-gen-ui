import { NextRequest } from "next/server";
import { z } from "zod";
import { readSessionCookies } from "@/features/auth/server/session-cookies";
import { readAgentApiConfig } from "@/features/agent/server/agent-api-config";
import { sessionUiSnapshotSchema } from "@/features/agent/session/session-ui-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const { accessToken } = readSessionCookies(request);
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
    const upstream = await fetch(endpoint, {
      method: "POST", cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(input),
    });
    if (!upstream.ok) return Response.json({ code: "snapshot_unavailable" }, { status: upstream.status === 409 ? 409 : 503, headers });
    const text = await upstream.text();
    if (new TextEncoder().encode(text).byteLength > 1_000_000) throw new Error("Snapshot demasiado grande");
    const snapshot = sessionUiSnapshotSchema.parse(JSON.parse(text));
    if (snapshot.sessionId !== input.sessionId) throw new Error("Snapshot ajeno");
    return Response.json(snapshot, { headers });
  } catch { return Response.json({ code: "snapshot_unavailable" }, { status: 503, headers }); }
}
