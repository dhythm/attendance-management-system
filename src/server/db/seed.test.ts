import { describe, expect, it } from "vitest";
import { workDateOf } from "@/domain/attendance";
import { demoShifts, readSeedPassword } from "./seed";

const jst = (iso: string) => new Date(`${iso}+09:00`);
const weekdayOf = (date: Date) => new Date(`${workDateOf(date)}T00:00:00Z`).getUTCDay();

describe("demoShifts", () => {
  const now = jst("2026-11-18T14:00:00");

  it("is the same for the same account and time", () => {
    expect(demoShifts("yamada", now)).toEqual(demoShifts("yamada", jst("2026-11-18T14:00:00")));
  });

  it("varies between accounts", () => {
    expect(demoShifts("suzuki", now)).not.toEqual(demoShifts("yamada", now));
  });

  it("covers the past two weeks of weekdays with closed shifts that end before now", () => {
    const shifts = demoShifts("suzuki", now);
    expect(shifts.map((s) => workDateOf(s.clockInAt))).toEqual([
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-16",
      "2026-11-17",
    ]);
    for (const shift of shifts) {
      expect([0, 6]).not.toContain(weekdayOf(shift.clockInAt));
      expect(shift.clockOutAt).not.toBeNull();
      expect(shift.clockOutAt?.getTime()).toBeGreaterThan(shift.clockInAt.getTime());
      expect(shift.clockOutAt?.getTime()).toBeLessThan(now.getTime());
    }
  });

  it("starts each day around 9:00 and ends around 18:00 in Asia/Tokyo", () => {
    for (const shift of demoShifts("suzuki", now)) {
      const day = workDateOf(shift.clockInAt);
      const start = jst(`${day}T09:00:00`).getTime();
      const end = jst(`${day}T18:00:00`).getTime();
      expect(Math.abs(shift.clockInAt.getTime() - start)).toBeLessThanOrEqual(30 * 60_000);
      expect(Math.abs((shift.clockOutAt?.getTime() ?? 0) - end)).toBeLessThanOrEqual(60 * 60_000);
    }
  });

  it("leaves yamada working since this morning", () => {
    const open = demoShifts("yamada", now).filter((s) => s.clockOutAt === null);
    expect(open).toHaveLength(1);
    expect(workDateOf(open[0]?.clockInAt ?? new Date(0))).toBe("2026-11-18");
    expect(open[0]?.clockInAt.getTime()).toBeLessThan(now.getTime());
  });

  it("never clocks yamada in after now, even just after midnight", () => {
    const earlyNow = jst("2026-11-18T00:30:00");
    const open = demoShifts("yamada", earlyNow).find((s) => s.clockOutAt === null);
    expect(open?.clockInAt.getTime()).toBeLessThanOrEqual(earlyNow.getTime());
    expect(workDateOf(open?.clockInAt ?? new Date(0))).toBe("2026-11-18");
  });

  it("gives accounts without demo attendance no shifts", () => {
    expect(demoShifts("admin", now)).toEqual([]);
  });
});

describe("readSeedPassword", () => {
  it("returns SEED_PASSWORD", () => {
    expect(readSeedPassword({ SEED_PASSWORD: "long-enough-password" })).toBe(
      "long-enough-password",
    );
  });

  it("fails with a clear message when SEED_PASSWORD is unset", () => {
    expect(() => readSeedPassword({})).toThrow(/SEED_PASSWORD/);
  });

  it("fails when SEED_PASSWORD is too short to log in with", () => {
    expect(() => readSeedPassword({ SEED_PASSWORD: "short" })).toThrow(/SEED_PASSWORD/);
  });
});
