import { NextResponse } from "next/server";
import { loadUsersOverview, parseMonthQuery } from "@/server/attendance-records";
import { withCapability } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { withErrorHandling } from "@/server/http";

export const GET = withErrorHandling(
  withCapability("viewAllAttendance", async (request) => {
    const month = parseMonthQuery(request, new Date());
    if (!month.ok) return month.error;
    return NextResponse.json(await loadUsersOverview(await getDb(), month.value));
  }),
);
