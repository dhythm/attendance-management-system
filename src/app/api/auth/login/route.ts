import { type NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/server/auth/cookie";
import { verifyCredentials } from "@/server/auth/credentials";
import { getDb } from "@/server/db/client";
import { errorResponse, parseJsonBody, withErrorHandling } from "@/server/http";
import { createSession } from "@/server/repositories/sessions";
import { loginRequestSchema } from "@/shared/api";

export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await parseJsonBody(request, loginRequestSchema);
  if (!body.ok) return body.error;

  const db = await getDb();
  const user = await verifyCredentials(db, body.value.loginId, body.value.password);
  if (!user) return errorResponse("INVALID_CREDENTIALS");

  const session = await createSession(db, user.id, new Date());
  const response = NextResponse.json({ user });
  setSessionCookie(response, session.token, session.expiresAt);
  return response;
});
