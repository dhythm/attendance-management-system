import type { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE = "session";

export function readSessionToken(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE)?.value || null;
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
