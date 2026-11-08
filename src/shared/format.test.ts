import { describe, expect, it } from "vitest";
import {
  formatClock,
  formatDateTime,
  formatDuration,
  formatElapsed,
  formatLongDate,
  formatTime,
  formatWorkDate,
  formatYearMonth,
  isWeekend,
  minutesOfDay,
} from "./format";

describe("formatDuration", () => {
  it("formats hours and zero-padded minutes, flooring seconds", () => {
    expect(formatDuration(8.5 * 3_600_000 + 59_000)).toBe("8:30");
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(125 * 3_600_000 + 5 * 60_000)).toBe("125:05");
  });
});

describe("formatTime", () => {
  it("shows the Asia/Tokyo wall-clock time", () => {
    expect(formatTime("2026-11-02T00:05:00.000Z")).toBe("09:05");
  });
});

describe("formatDateTime", () => {
  it("shows the Asia/Tokyo date and time", () => {
    expect(formatDateTime("2026-10-31T15:30:00.000Z")).toBe("2026/11/01 00:30");
  });
});

describe("formatWorkDate", () => {
  it("shows month, day and weekday in Japanese", () => {
    expect(formatWorkDate("2026-11-02")).toBe("11/2(月)");
  });
});

describe("formatYearMonth", () => {
  it("shows the year and month in Japanese", () => {
    expect(formatYearMonth("2026-01")).toBe("2026年1月");
  });
});

describe("formatClock", () => {
  it("shows the Asia/Tokyo time with seconds", () => {
    expect(formatClock(new Date("2026-11-02T15:04:05.000Z"))).toBe("00:04:05");
  });
});

describe("formatElapsed", () => {
  it("shows hours, minutes and seconds, flooring milliseconds", () => {
    expect(formatElapsed(3 * 3_600_000 + 7 * 60_000 + 9_999)).toBe("3:07:09");
    expect(formatElapsed(0)).toBe("0:00:00");
  });
});

describe("formatLongDate", () => {
  it("shows the Asia/Tokyo calendar date with the weekday", () => {
    expect(formatLongDate(new Date("2026-11-07T15:30:00.000Z"))).toBe("2026年11月8日（日）");
  });
});

describe("minutesOfDay", () => {
  it("counts minutes since midnight in Asia/Tokyo", () => {
    expect(minutesOfDay("2026-11-02T00:05:00.000Z")).toBe(9 * 60 + 5);
    expect(minutesOfDay("2026-11-01T15:00:00.000Z")).toBe(0);
  });
});

describe("isWeekend", () => {
  it("is true only for Saturday and Sunday work dates", () => {
    expect(isWeekend("2026-11-07")).toBe(true);
    expect(isWeekend("2026-11-08")).toBe(true);
    expect(isWeekend("2026-11-09")).toBe(false);
  });
});
