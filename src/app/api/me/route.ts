import { type NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/server/auth/current-user";
import { errorResponse, withErrorHandling } from "@/server/http";

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request);
  if (!user) return errorResponse("UNAUTHORIZED");
  return NextResponse.json({ user });
});
