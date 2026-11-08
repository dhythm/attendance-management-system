import { NextResponse } from "next/server";
import { loadStatus, toStatusResponse } from "@/server/attendance-status";
import { withUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { withErrorHandling } from "@/server/http";

export const GET = withErrorHandling(
  withUser(async (_request, user) => {
    const status = await loadStatus(await getDb(), user.id);
    return NextResponse.json(toStatusResponse(status));
  }),
);
