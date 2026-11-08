import { describe, expect, it } from "vitest";
import { can, canEditAttendance } from "./role";

describe("can", () => {
  it.each([
    ["employee", "clock", true],
    ["employee", "viewAllAttendance", false],
    ["employee", "manageUsers", false],
    ["employee", "editOwnAttendance", true],
    ["employee", "editAllAttendance", false],
    ["manager", "clock", true],
    ["manager", "viewAllAttendance", true],
    ["manager", "manageUsers", false],
    ["manager", "editOwnAttendance", true],
    ["manager", "editAllAttendance", true],
    ["admin", "clock", true],
    ["admin", "viewAllAttendance", true],
    ["admin", "manageUsers", true],
    ["admin", "editOwnAttendance", true],
    ["admin", "editAllAttendance", true],
  ] as const)("%s can %s: %s", (role, capability, expected) => {
    expect(can(role, capability)).toBe(expected);
  });
});

describe("canEditAttendance", () => {
  it.each([
    ["employee", true, true],
    ["employee", false, false],
    ["manager", true, true],
    ["manager", false, true],
    ["admin", true, true],
    ["admin", false, true],
  ] as const)("%s editing own records (%s): %s", (role, own, expected) => {
    expect(canEditAttendance(role, own)).toBe(expected);
  });
});
