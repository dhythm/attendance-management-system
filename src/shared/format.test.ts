import { describe, expect, it } from "vitest";
import { formatDuration, formatTime, formatWorkDate, formatYearMonth } from "./format";

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
