import { describe, expect, it } from "vitest";
import {
  currentYearMonth,
  decideClockIn,
  decideClockOut,
  deriveStatus,
  monthRange,
  parseYearMonth,
  shiftMonth,
  summarizeMonth,
  workDateOf,
} from "./attendance";

const jst = (iso: string) => new Date(`${iso}+09:00`);

describe("deriveStatus", () => {
  it("is off duty when there is no open record", () => {
    expect(deriveStatus(null)).toEqual({ kind: "off_duty" });
  });

  it("is working since the open record's clock-in", () => {
    const since = jst("2026-11-02T09:00:00");
    expect(deriveStatus({ clockInAt: since })).toEqual({ kind: "working", since });
  });
});

describe("decideClockIn", () => {
  const now = jst("2026-11-02T09:00:00");

  it("clocks in at now when off duty", () => {
    expect(decideClockIn({ kind: "off_duty" }, now)).toEqual({
      ok: true,
      value: { clockInAt: now },
    });
  });

  it("refuses when already working", () => {
    const status = { kind: "working", since: jst("2026-11-02T08:00:00") } as const;
    expect(decideClockIn(status, now)).toEqual({ ok: false, error: "ALREADY_WORKING" });
  });
});

describe("decideClockOut", () => {
  const since = jst("2026-11-02T09:00:00");

  it("clocks out at now when working", () => {
    const now = jst("2026-11-02T18:00:00");
    expect(decideClockOut({ kind: "working", since }, now)).toEqual({
      ok: true,
      value: { clockOutAt: now },
    });
  });

  it("refuses when off duty", () => {
    expect(decideClockOut({ kind: "off_duty" }, since)).toEqual({
      ok: false,
      error: "NOT_WORKING",
    });
  });

  it("refuses a clock-out that is not after the clock-in", () => {
    expect(decideClockOut({ kind: "working", since }, since)).toEqual({
      ok: false,
      error: "CLOCK_OUT_NOT_AFTER_CLOCK_IN",
    });
  });
});

describe("workDateOf", () => {
  it("uses the Asia/Tokyo calendar date, not UTC", () => {
    expect(workDateOf(new Date("2026-11-01T15:30:00Z"))).toBe("2026-11-02");
    expect(workDateOf(new Date("2026-11-01T14:59:59Z"))).toBe("2026-11-01");
  });
});

describe("parseYearMonth", () => {
  it("accepts YYYY-MM", () => {
    expect(parseYearMonth("2026-11")).toBe("2026-11");
  });

  it.each(["2026-13", "2026-00", "2026-1", "202611", "abc", ""])("rejects %s", (input) => {
    expect(parseYearMonth(input)).toBeNull();
  });
});

describe("currentYearMonth", () => {
  it("is the Asia/Tokyo month", () => {
    expect(currentYearMonth(new Date("2026-10-31T15:00:00Z"))).toBe("2026-11");
    expect(currentYearMonth(new Date("2026-10-31T14:59:59Z"))).toBe("2026-10");
  });
});

describe("monthRange", () => {
  it("spans the month in Asia/Tokyo as a half-open range", () => {
    const month = parseYearMonth("2026-11");
    if (!month) throw new Error("invalid month");
    expect(monthRange(month)).toEqual({
      start: jst("2026-11-01T00:00:00"),
      end: jst("2026-12-01T00:00:00"),
    });
  });

  it("rolls over the year in December", () => {
    const month = parseYearMonth("2026-12");
    if (!month) throw new Error("invalid month");
    expect(monthRange(month).end).toEqual(jst("2027-01-01T00:00:00"));
  });
});

describe("summarizeMonth", () => {
  it("groups shifts by clock-in date with per-day durations and a monthly total", () => {
    const summary = summarizeMonth([
      { clockInAt: jst("2026-11-02T09:00:00"), clockOutAt: jst("2026-11-02T12:00:00") },
      { clockInAt: jst("2026-11-02T13:00:00"), clockOutAt: jst("2026-11-02T18:00:00") },
      { clockInAt: jst("2026-11-03T22:00:00"), clockOutAt: jst("2026-11-04T06:30:00") },
      { clockInAt: jst("2026-11-05T09:00:00"), clockOutAt: null },
    ]);
    expect(summary.days.map((d) => [d.workDate, d.shifts.length, d.durationMs, d.working])).toEqual(
      [
        ["2026-11-02", 2, 8 * 3_600_000, false],
        ["2026-11-03", 1, 8.5 * 3_600_000, false],
        ["2026-11-05", 1, 0, true],
      ],
    );
    expect(summary.days[0]?.shifts.map((s) => s.durationMs)).toEqual([
      3 * 3_600_000,
      5 * 3_600_000,
    ]);
    expect(summary.days[2]?.shifts[0]?.durationMs).toBeNull();
    expect(summary.totalMs).toBe(16.5 * 3_600_000);
  });

  it("totals zero for no records", () => {
    expect(summarizeMonth([])).toEqual({ days: [], totalMs: 0 });
  });
});

describe("shiftMonth", () => {
  it("moves across year boundaries", () => {
    const november = parseYearMonth("2026-11");
    const january = parseYearMonth("2027-01");
    if (!november || !january) throw new Error("invalid month");
    expect(shiftMonth(november, 2)).toBe("2027-01");
    expect(shiftMonth(january, -1)).toBe("2026-12");
  });
});
