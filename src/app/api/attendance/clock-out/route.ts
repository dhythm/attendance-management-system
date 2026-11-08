import { NextResponse } from "next/server";
import { decideClockOut } from "@/domain/attendance";
import { loadStatus, toStatusResponse } from "@/server/attendance-status";
import { withCapability } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { errorResponse, withErrorHandling } from "@/server/http";
import { closeOpenRecord } from "@/server/repositories/attendance";

export const POST = withErrorHandling(
  withCapability("clock", async (_request, user) => {
    const db = await getDb();
    const decision = decideClockOut(await loadStatus(db, user.id), new Date());
    if (!decision.ok) return errorResponse(decision.error);

    const closed = await closeOpenRecord(db, user.id, decision.value.clockOutAt);
    if (closed !== "OK") return errorResponse(closed);

    return NextResponse.json(toStatusResponse({ kind: "off_duty" }));
  }),
);
