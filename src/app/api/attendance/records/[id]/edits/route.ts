import { NextResponse } from "next/server";
import { loadRecordEdits } from "@/server/attendance-edits";
import { toRecordEditsResponse } from "@/server/attendance-records";
import { withCapability } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { errorResponse, withErrorHandling } from "@/server/http";
import { parseRecordId } from "@/server/repositories/attendance";

export const GET = withErrorHandling(
  withCapability<RouteContext<"/api/attendance/records/[id]/edits">>(
    "editOwnAttendance",
    async (_request, user, ctx) => {
      const recordId = parseRecordId((await ctx.params).id);
      if (!recordId) return errorResponse("RECORD_NOT_FOUND");
      const edits = await loadRecordEdits(await getDb(), user, recordId);
      if (!edits.ok) return errorResponse(edits.error);
      return NextResponse.json(toRecordEditsResponse(edits.value));
    },
  ),
);
