import { NextResponse } from "next/server";
import { demoLoginAvailable } from "@/features/auth/server/demo-availability";
import { signInWithPassword } from "@/features/auth/server/supabase-session";
import { writeSessionCookies } from "@/features/auth/server/session-cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!demoLoginAvailable()) {
    return NextResponse.json({ authenticated: false }, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const session = await signInWithPassword(
      process.env.BANORTE_DEMO_EMAIL!.trim(),
      process.env.BANORTE_DEMO_PASSWORD!,
    );
    const response = NextResponse.json({ authenticated: true }, {
      headers: { "Cache-Control": "no-store" },
    });
    writeSessionCookies(response, session);
    return response;
  } catch {
    return NextResponse.json({ authenticated: false }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
