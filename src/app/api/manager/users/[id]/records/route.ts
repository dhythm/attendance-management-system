import { NextResponse } from "next/server";
import { loadMonthRecords, parseMonthQuery } from "@/server/attendance-records";
import { withCapability } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { errorResponse, withErrorHandling } from "@/server/http";
import { findUserById, parseUserId } from "@/server/repositories/users";

export const GET = withErrorHandling(
  withCapability<RouteContext<"/api/manager/users/[id]/records">>(
    "viewAllAttendance",
    async (request, _user, ctx) => {
      const month = parseMonthQuery(request, new Date());
      if (!month.ok) return month.error;
      const db = await getDb();
      const userId = parseUserId((await ctx.params).id);
      const target = userId && (await findUserById(db, userId));
      if (!target) return errorResponse("USER_NOT_FOUND");
      return NextResponse.json(await loadMonthRecords(db, target.id, month.value));
    },
  ),
);
