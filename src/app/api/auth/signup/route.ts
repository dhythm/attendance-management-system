import { type NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/server/auth/cookie";
import { hashPassword } from "@/server/auth/password";
import { getDb } from "@/server/db/client";
import { errorResponse, parseJsonBody, withErrorHandling } from "@/server/http";
import { createSession } from "@/server/repositories/sessions";
import { createUser } from "@/server/repositories/users";
import { signupRequestSchema } from "@/shared/api";

export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await parseJsonBody(request, signupRequestSchema);
  if (!body.ok) return body.error;
  const { loginId, displayName, password } = body.value;

  const db = await getDb();
  const user = await createUser(db, {
    loginId,
    displayName,
    passwordHash: await hashPassword(password),
  });
  if (user === "LOGIN_ID_TAKEN") return errorResponse("LOGIN_ID_TAKEN");

  const session = await createSession(db, user.id, new Date());
  const response = NextResponse.json({ user }, { status: 201 });
  setSessionCookie(response, session.token, session.expiresAt);
  return response;
});
