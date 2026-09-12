import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import type { SupabaseUserSession } from "./supabase-session";

export const ACCESS_TOKEN_COOKIE = "banorte-user-session";
export const REFRESH_TOKEN_COOKIE = "banorte-user-refresh";

const baseCookie = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function readSessionCookies(request: NextRequest) {
  return {
    accessToken: normalizeToken(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value, 20),
    refreshToken: normalizeToken(request.cookies.get(REFRESH_TOKEN_COOKIE)?.value, 1),
  };
}

export function writeSessionCookies(response: NextResponse, session: SupabaseUserSession) {
  response.cookies.set({
    ...baseCookie,
    name: ACCESS_TOKEN_COOKIE,
    value: session.accessToken,
    maxAge: session.expiresIn,
  });
  response.cookies.set({
    ...baseCookie,
    name: REFRESH_TOKEN_COOKIE,
    value: session.refreshToken,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set({ ...baseCookie, name: ACCESS_TOKEN_COOKIE, value: "", maxAge: 0 });
  response.cookies.set({ ...baseCookie, name: REFRESH_TOKEN_COOKIE, value: "", maxAge: 0 });
}

function normalizeToken(value: string | undefined, minimumLength: number) {
  const token = value?.trim();
  return token && token.length >= minimumLength && token.length <= 8_192 ? token : undefined;
}
