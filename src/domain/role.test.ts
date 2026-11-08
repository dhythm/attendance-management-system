import { describe, expect, it } from "vitest";
import { can } from "./role";

describe("can", () => {
  it.each([
    ["employee", "clock", true],
    ["employee", "viewAllAttendance", false],
    ["employee", "manageUsers", false],
    ["manager", "clock", true],
    ["manager", "viewAllAttendance", true],
    ["manager", "manageUsers", false],
    ["admin", "clock", true],
    ["admin", "viewAllAttendance", true],
    ["admin", "manageUsers", true],
  ] as const)("%s can %s: %s", (role, capability, expected) => {
    expect(can(role, capability)).toBe(expected);
  });
});
