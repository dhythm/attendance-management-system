import { NextResponse } from "next/server";
import { decideClockIn } from "@/domain/attendance";
import { loadStatus, toStatusResponse } from "@/server/attendance-status";
import { withCapability } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { errorResponse, withErrorHandling } from "@/server/http";
import { insertOpenRecord } from "@/server/repositories/attendance";

export const POST = withErrorHandling(
  withCapability("clock", async (_request, user) => {
    const db = await getDb();
    const decision = decideClockIn(await loadStatus(db, user.id), new Date());
    if (!decision.ok) return errorResponse(decision.error);

    const { clockInAt } = decision.value;
    const inserted = await insertOpenRecord(db, user.id, clockInAt);
    if (inserted !== "OK") return errorResponse(inserted);

    return NextResponse.json(toStatusResponse({ kind: "working", since: clockInAt }), {
      status: 201,
    });
  }),
);
