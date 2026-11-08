import type { NextRequest } from "next/server";
import {
  currentYearMonth,
  deriveStatus,
  monthRange,
  parseYearMonth,
  summarizeMonth,
  workDurationMs,
  type YearMonth,
} from "@/domain/attendance";
import { err, ok, type Result } from "@/domain/result";
import type { UserId } from "@/domain/user";
import { toStatusResponse } from "@/server/attendance-status";
import type { Db } from "@/server/db/client";
import { errorResponse } from "@/server/http";
import {
  type AttendanceRecordEdit,
  type ListedAttendanceRecord,
  listAllOpenRecords,
  listAllRecordsClockedInBetween,
  listRecordsClockedInBetween,
  type UserAttendanceRecord,
} from "@/server/repositories/attendance";
import { listUsers } from "@/server/repositories/users";
import type {
  RecordEditsResponse,
  RecordsResponse,
  ShiftResponse,
  UsersOverviewResponse,
} from "@/shared/api";

export function parseMonthQuery(request: NextRequest, now: Date): Result<YearMonth, Response> {
  const param = request.nextUrl.searchParams.get("month");
  const month = param === null ? currentYearMonth(now) : parseYearMonth(param);
  return month
    ? ok(month)
    : err(errorResponse("VALIDATION_ERROR", "月はYYYY-MM形式で指定してください"));
}

export async function loadMonthRecords(
  db: Db,
  userId: UserId,
  month: YearMonth,
): Promise<RecordsResponse> {
  const summary = summarizeMonth(await listRecordsClockedInBetween(db, userId, monthRange(month)));
  return {
    month,
    days: summary.days.map((day) => ({
      workDate: day.workDate,
      durationMs: day.durationMs,
      working: day.working,
      shifts: day.shifts.map(toShiftResponse),
    })),
    totalMs: summary.totalMs,
  };
}

export function toShiftResponse(record: ListedAttendanceRecord): ShiftResponse {
  return {
    id: record.id,
    clockInAt: record.clockInAt.toISOString(),
    clockOutAt: record.clockOutAt?.toISOString() ?? null,
    clockInSource: record.clockInSource,
    clockOutSource: record.clockOutSource,
    editCount: record.editCount,
    durationMs: workDurationMs(record),
  };
}

export function toRecordEditsResponse(edits: AttendanceRecordEdit[]): RecordEditsResponse {
  return {
    edits: edits.map((edit) => ({
      id: edit.id,
      editor: { id: edit.editorId, displayName: edit.editorDisplayName },
      previousClockInAt: edit.previousClockInAt.toISOString(),
      previousClockOutAt: edit.previousClockOutAt?.toISOString() ?? null,
      newClockInAt: edit.newClockInAt.toISOString(),
      newClockOutAt: edit.newClockOutAt?.toISOString() ?? null,
      reason: edit.reason,
      createdAt: edit.createdAt.toISOString(),
    })),
  };
}

export async function loadUsersOverview(db: Db, month: YearMonth): Promise<UsersOverviewResponse> {
  const [allUsers, openRecords, monthRecords] = await Promise.all([
    listUsers(db),
    listAllOpenRecords(db),
    listAllRecordsClockedInBetween(db, monthRange(month)),
  ]);
  const openByUser = new Map(openRecords.map((record) => [record.userId, record]));
  const recordsByUser = new Map<UserId, UserAttendanceRecord[]>();
  for (const record of monthRecords) {
    const list = recordsByUser.get(record.userId) ?? [];
    list.push(record);
    recordsByUser.set(record.userId, list);
  }
  return {
    month,
    users: allUsers.map((user) => ({
      ...user,
      status: toStatusResponse(deriveStatus(openByUser.get(user.id) ?? null)).status,
      totalMs: summarizeMonth(recordsByUser.get(user.id) ?? []).totalMs,
    })),
  };
}
