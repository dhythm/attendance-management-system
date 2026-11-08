import { type NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, readSessionToken } from "@/server/auth/cookie";
import { getDb } from "@/server/db/client";
import { withErrorHandling } from "@/server/http";
import { deleteSession } from "@/server/repositories/sessions";

export const POST = withErrorHandling(async (request: NextRequest) => {
  const token = readSessionToken(request);
  if (token) await deleteSession(await getDb(), token);
  const response = new NextResponse(null, { status: 204 });
  clearSessionCookie(response);
  return response;
});
