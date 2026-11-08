import { NextResponse } from "next/server";
import { withUser } from "@/server/auth/current-user";
import { withErrorHandling } from "@/server/http";

export const GET = withErrorHandling(
  withUser(async (_request, user) => NextResponse.json({ user })),
);
