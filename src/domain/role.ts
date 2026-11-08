export const roles = ["employee", "manager", "admin"] as const;
export type Role = (typeof roles)[number];

export type Capability =
  | "clock"
  | "viewAllAttendance"
  | "manageUsers"
  | "editOwnAttendance"
  | "editAllAttendance";

const permissions: Record<Role, ReadonlySet<Capability>> = {
  employee: new Set(["clock", "editOwnAttendance"]),
  manager: new Set(["clock", "viewAllAttendance", "editOwnAttendance", "editAllAttendance"]),
  admin: new Set([
    "clock",
    "viewAllAttendance",
    "manageUsers",
    "editOwnAttendance",
    "editAllAttendance",
  ]),
};

export function can(role: Role, capability: Capability): boolean {
  return permissions[role].has(capability);
}

export function canEditAttendance(role: Role, ownRecords: boolean): boolean {
  return can(role, ownRecords ? "editOwnAttendance" : "editAllAttendance");
}
