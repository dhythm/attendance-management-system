import { err, ok, type Result } from "./result";

export type AttendanceStatus = { kind: "off_duty" } | { kind: "working"; since: Date };

export type ClockInError = "ALREADY_WORKING";
export type ClockOutError = "NOT_WORKING" | "CLOCK_OUT_NOT_AFTER_CLOCK_IN";

export type WorkDate = string & { readonly __brand: "WorkDate" };
export type YearMonth = string & { readonly __brand: "YearMonth" };

type Shift = { clockInAt: Date; clockOutAt: Date | null };

export const timeSources = ["clock", "edit"] as const;
export type TimeSource = (typeof timeSources)[number];

export type SourcedShift = Shift & { clockInSource: TimeSource; clockOutSource: TimeSource | null };

export type EditError =
  | "NO_CHANGES"
  | "CLOCK_OUT_REQUIRED"
  | "CLOCK_OUT_NOT_AFTER_CLOCK_IN"
  | "FUTURE_TIME"
  | "OVERLAPPING_RECORD";

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

function sameInstant(a: Date | null, b: Date | null): boolean {
  return a === null || b === null ? a === b : a.getTime() === b.getTime();
}

function overlaps(a: Shift, b: Shift, now: Date): boolean {
  const end = (shift: Shift) => (shift.clockOutAt ?? now).getTime();
  return a.clockInAt.getTime() < end(b) && b.clockInAt.getTime() < end(a);
}

export function decideEdit(
  record: SourcedShift,
  otherRecordsOfUser: readonly Shift[],
  input: Shift,
  now: Date,
): Result<SourcedShift, EditError> {
  const clockInChanged = !sameInstant(record.clockInAt, input.clockInAt);
  const clockOutChanged = !sameInstant(record.clockOutAt, input.clockOutAt);
  if (!clockInChanged && !clockOutChanged) return err("NO_CHANGES");
  if (record.clockOutAt && !input.clockOutAt) return err("CLOCK_OUT_REQUIRED");
  if (input.clockOutAt && input.clockOutAt.getTime() <= input.clockInAt.getTime()) {
    return err("CLOCK_OUT_NOT_AFTER_CLOCK_IN");
  }
  const latest = Math.max(input.clockInAt.getTime(), input.clockOutAt?.getTime() ?? 0);
  if (latest > now.getTime()) return err("FUTURE_TIME");
  if (otherRecordsOfUser.some((other) => overlaps(input, other, now))) {
    return err("OVERLAPPING_RECORD");
  }
  return ok({
    clockInAt: input.clockInAt,
    clockOutAt: input.clockOutAt,
    clockInSource: clockInChanged ? "edit" : record.clockInSource,
    clockOutSource: clockOutChanged ? "edit" : record.clockOutSource,
  });
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

export type WorkDay<R> = {
  workDate: WorkDate;
  shifts: (R & { durationMs: number | null })[];
  durationMs: number;
  working: boolean;
};

export function summarizeMonth<R extends Shift>(
  records: readonly R[],
): { days: WorkDay<R>[]; totalMs: number } {
  const days = new Map<WorkDate, WorkDay<R>>();
  for (const record of records) {
    const workDate = workDateOf(record.clockInAt);
    const day = days.get(workDate) ?? { workDate, shifts: [], durationMs: 0, working: false };
    const durationMs = workDurationMs(record);
    day.shifts.push({ ...record, durationMs });
    day.durationMs += durationMs ?? 0;
    day.working ||= durationMs === null;
    days.set(workDate, day);
  }
  const list = [...days.values()].sort((a, b) => a.workDate.localeCompare(b.workDate));
  return { days: list, totalMs: list.reduce((sum, day) => sum + day.durationMs, 0) };
}

export function shiftMonth(month: YearMonth, delta: number): YearMonth {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
    .toISOString()
    .slice(0, 7) as YearMonth;
}
