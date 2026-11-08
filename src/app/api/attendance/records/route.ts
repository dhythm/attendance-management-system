import { NextResponse } from "next/server";
import { loadMonthRecords, parseMonthQuery } from "@/server/attendance-records";
import { withCapability } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { withErrorHandling } from "@/server/http";

export const GET = withErrorHandling(
  withCapability("clock", async (request, user) => {
    const month = parseMonthQuery(request, new Date());
    if (!month.ok) return month.error;
    return NextResponse.json(await loadMonthRecords(await getDb(), user.id, month.value));
  }),
);
