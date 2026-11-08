import { NextResponse } from "next/server";
import { editAttendanceRecord } from "@/server/attendance-edits";
import { toShiftResponse } from "@/server/attendance-records";
import { withCapability } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { errorResponse, parseJsonBody, withErrorHandling } from "@/server/http";
import { parseRecordId } from "@/server/repositories/attendance";
import { editRecordRequestSchema } from "@/shared/api";

export const PATCH = withErrorHandling(
  withCapability<RouteContext<"/api/attendance/records/[id]">>(
    "editOwnAttendance",
    async (request, user, ctx) => {
      const recordId = parseRecordId((await ctx.params).id);
      if (!recordId) return errorResponse("RECORD_NOT_FOUND");
      const body = await parseJsonBody(request, editRecordRequestSchema);
      if (!body.ok) return body.error;

      const edited = await editAttendanceRecord(await getDb(), {
        recordId,
        editor: user,
        clockInAt: new Date(body.value.clockInAt),
        clockOutAt: body.value.clockOutAt === null ? null : new Date(body.value.clockOutAt),
        reason: body.value.reason,
        now: new Date(),
      });
      if (!edited.ok) return errorResponse(edited.error);
      return NextResponse.json({ shift: toShiftResponse(edited.value) });
    },
  ),
);
