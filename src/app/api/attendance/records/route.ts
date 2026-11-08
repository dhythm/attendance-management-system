import { NextResponse } from "next/server";
import { currentYearMonth, monthRange, parseYearMonth, summarizeMonth } from "@/domain/attendance";
import { withUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { errorResponse, withErrorHandling } from "@/server/http";
import { listRecordsClockedInBetween } from "@/server/repositories/attendance";
import type { RecordsResponse } from "@/shared/api";

export const GET = withErrorHandling(
  withUser(async (request, user) => {
    const param = request.nextUrl.searchParams.get("month");
    const month = param === null ? currentYearMonth(new Date()) : parseYearMonth(param);
    if (!month) return errorResponse("VALIDATION_ERROR", "月はYYYY-MM形式で指定してください");

    const records = await listRecordsClockedInBetween(await getDb(), user.id, monthRange(month));
    const summary = summarizeMonth(records);
    const body: RecordsResponse = {
      month,
      entries: summary.entries.map((entry) => ({
        id: entry.id,
        workDate: entry.workDate,
        clockInAt: entry.clockInAt.toISOString(),
        clockOutAt: entry.clockOutAt?.toISOString() ?? null,
        durationMs: entry.durationMs,
      })),
      totalMs: summary.totalMs,
    };
    return NextResponse.json(body);
  }),
);
