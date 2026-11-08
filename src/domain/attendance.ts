import { err, ok, type Result } from "./result";

export type AttendanceStatus = { kind: "off_duty" } | { kind: "working"; since: Date };

export type ClockInError = "ALREADY_WORKING";
export type ClockOutError = "NOT_WORKING" | "CLOCK_OUT_NOT_AFTER_CLOCK_IN";

export type WorkDate = string & { readonly __brand: "WorkDate" };
export type YearMonth = string & { readonly __brand: "YearMonth" };

type Shift = { clockInAt: Date; clockOutAt: Date | null };

// Asia/Tokyo has had no DST since 1951, so a fixed offset is exact.
const TOKYO_OFFSET_MS = 9 * 60 * 60 * 1000;

export function deriveStatus(openRecord: { clockInAt: Date } | null): AttendanceStatus {
  return openRecord ? { kind: "working", since: openRecord.clockInAt } : { kind: "off_duty" };
}

export function decideClockIn(
  status: AttendanceStatus,
  now: Date,
): Result<{ clockInAt: Date }, ClockInError> {
  if (status.kind === "working") return err("ALREADY_WORKING");
  return ok({ clockInAt: now });
}

export function decideClockOut(
  status: AttendanceStatus,
  now: Date,
): Result<{ clockOutAt: Date }, ClockOutError> {
  if (status.kind === "off_duty") return err("NOT_WORKING");
  if (now.getTime() <= status.since.getTime()) return err("CLOCK_OUT_NOT_AFTER_CLOCK_IN");
  return ok({ clockOutAt: now });
}

function toTokyoWallClock(instant: Date): Date {
  return new Date(instant.getTime() + TOKYO_OFFSET_MS);
}

export function workDateOf(clockInAt: Date): WorkDate {
  return toTokyoWallClock(clockInAt).toISOString().slice(0, 10) as WorkDate;
}

export function currentYearMonth(now: Date): YearMonth {
  return toTokyoWallClock(now).toISOString().slice(0, 7) as YearMonth;
}

export function parseYearMonth(input: string): YearMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(input);
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? (input as YearMonth) : null;
}

export function monthRange(month: YearMonth): { start: Date; end: Date } {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const startUtc = Date.UTC(year, monthNumber - 1, 1) - TOKYO_OFFSET_MS;
  const endUtc = Date.UTC(year, monthNumber, 1) - TOKYO_OFFSET_MS;
  return { start: new Date(startUtc), end: new Date(endUtc) };
}

export function workDurationMs(shift: Shift): number | null {
  return shift.clockOutAt ? shift.clockOutAt.getTime() - shift.clockInAt.getTime() : null;
}

export function summarizeMonth<R extends Shift>(
  records: readonly R[],
): { entries: (R & { workDate: WorkDate; durationMs: number | null })[]; totalMs: number } {
  const entries = records.map((record) => ({
    ...record,
    workDate: workDateOf(record.clockInAt),
    durationMs: workDurationMs(record),
  }));
  const totalMs = entries.reduce((sum, entry) => sum + (entry.durationMs ?? 0), 0);
  return { entries, totalMs };
}

export function shiftMonth(month: YearMonth, delta: number): YearMonth {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
    .toISOString()
    .slice(0, 7) as YearMonth;
}
