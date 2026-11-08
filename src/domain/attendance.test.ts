import { describe, expect, it } from "vitest";
import {
  currentYearMonth,
  decideClockIn,
  decideClockOut,
  decideEdit,
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

describe("decideEdit", () => {
  const now = jst("2026-11-10T12:00:00");
  const closed = {
    clockInAt: jst("2026-11-09T09:03:00"),
    clockOutAt: jst("2026-11-09T18:00:00"),
    clockInSource: "clock",
    clockOutSource: "clock",
  } as const;
  const open = {
    clockInAt: jst("2026-11-10T09:00:00"),
    clockOutAt: null,
    clockInSource: "clock",
    clockOutSource: null,
  } as const;

  it("marks only a changed clock-in as edited", () => {
    const input = { clockInAt: jst("2026-11-09T09:00:00"), clockOutAt: closed.clockOutAt };
    expect(decideEdit(closed, [], input, now)).toEqual({
      ok: true,
      value: { ...input, clockInSource: "edit", clockOutSource: "clock" },
    });
  });

  it("marks only a changed clock-out as edited", () => {
    const input = { clockInAt: closed.clockInAt, clockOutAt: jst("2026-11-09T19:00:00") };
    expect(decideEdit(closed, [], input, now)).toEqual({
      ok: true,
      value: { ...input, clockInSource: "clock", clockOutSource: "edit" },
    });
  });

  it("keeps an earlier edit's source on a field this edit leaves unchanged", () => {
    const edited = { ...closed, clockInSource: "edit" } as const;
    const input = { clockInAt: closed.clockInAt, clockOutAt: jst("2026-11-09T19:00:00") };
    const decision = decideEdit(edited, [], input, now);
    expect(decision.ok && decision.value.clockInSource).toBe("edit");
  });

  it("closes an open record with an edited clock-out", () => {
    const input = { clockInAt: open.clockInAt, clockOutAt: jst("2026-11-10T11:00:00") };
    expect(decideEdit(open, [], input, now)).toEqual({
      ok: true,
      value: { ...input, clockInSource: "clock", clockOutSource: "edit" },
    });
  });

  it("keeps an open record open when only its clock-in changes", () => {
    const input = { clockInAt: jst("2026-11-10T08:45:00"), clockOutAt: null };
    expect(decideEdit(open, [], input, now)).toEqual({
      ok: true,
      value: { ...input, clockInSource: "edit", clockOutSource: null },
    });
  });

  it("rejects an edit that changes nothing", () => {
    const input = { clockInAt: closed.clockInAt, clockOutAt: closed.clockOutAt };
    expect(decideEdit(closed, [], input, now)).toEqual({ ok: false, error: "NO_CHANGES" });
  });

  it("rejects clearing an existing clock-out", () => {
    const input = { clockInAt: jst("2026-11-09T09:00:00"), clockOutAt: null };
    expect(decideEdit(closed, [], input, now)).toEqual({
      ok: false,
      error: "CLOCK_OUT_REQUIRED",
    });
  });

  it.each([
    ["before", "2026-11-09T08:00:00"],
    ["equal to", "2026-11-09T09:03:00"],
  ])("rejects a clock-out %s the clock-in", (_name, clockOut) => {
    const input = { clockInAt: closed.clockInAt, clockOutAt: jst(clockOut) };
    expect(decideEdit(closed, [], input, now)).toEqual({
      ok: false,
      error: "CLOCK_OUT_NOT_AFTER_CLOCK_IN",
    });
  });

  it.each([
    ["clock-in", { clockInAt: jst("2026-11-10T12:01:00"), clockOutAt: null }],
    ["clock-out", { clockInAt: open.clockInAt, clockOutAt: jst("2026-11-10T12:01:00") }],
  ])("rejects a %s in the future", (_name, input) => {
    expect(decideEdit(open, [], input, now)).toEqual({ ok: false, error: "FUTURE_TIME" });
  });

  it("accepts times exactly at now", () => {
    const input = { clockInAt: open.clockInAt, clockOutAt: now };
    expect(decideEdit(open, [], input, now).ok).toBe(true);
  });

  describe("overlap with the user's other records", () => {
    const previous = {
      clockInAt: jst("2026-11-08T22:00:00"),
      clockOutAt: jst("2026-11-09T06:00:00"),
    };

    it("rejects a shift that starts inside another", () => {
      const input = { clockInAt: jst("2026-11-09T05:00:00"), clockOutAt: closed.clockOutAt };
      expect(decideEdit(closed, [previous], input, now)).toEqual({
        ok: false,
        error: "OVERLAPPING_RECORD",
      });
    });

    it("allows a shift that starts exactly when another ends", () => {
      const input = { clockInAt: jst("2026-11-09T06:00:00"), clockOutAt: closed.clockOutAt };
      expect(decideEdit(closed, [previous], input, now).ok).toBe(true);
    });

    it("rejects a shift that covers another entirely", () => {
      const input = { clockInAt: jst("2026-11-08T21:00:00"), clockOutAt: closed.clockOutAt };
      expect(decideEdit(closed, [previous], input, now)).toEqual({
        ok: false,
        error: "OVERLAPPING_RECORD",
      });
    });

    it("treats an open record as running until now", () => {
      const input = { clockInAt: closed.clockInAt, clockOutAt: jst("2026-11-10T09:30:00") };
      expect(decideEdit(closed, [open], input, now)).toEqual({
        ok: false,
        error: "OVERLAPPING_RECORD",
      });
    });

    it("treats the edited open record as running until now", () => {
      const later = {
        clockInAt: jst("2026-11-10T10:00:00"),
        clockOutAt: jst("2026-11-10T11:00:00"),
      };
      const input = { clockInAt: jst("2026-11-10T08:00:00"), clockOutAt: null };
      expect(decideEdit(open, [later], input, now)).toEqual({
        ok: false,
        error: "OVERLAPPING_RECORD",
      });
    });
  });
});
