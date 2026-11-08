export const roles = ["employee", "manager", "admin"] as const;
export type Role = (typeof roles)[number];

export type Capability = "clock" | "viewAllAttendance" | "manageUsers";

const permissions: Record<Role, ReadonlySet<Capability>> = {
  employee: new Set(["clock"]),
  manager: new Set(["clock", "viewAllAttendance"]),
  admin: new Set(["clock", "viewAllAttendance", "manageUsers"]),
};

export function can(role: Role, capability: Capability): boolean {
  return permissions[role].has(capability);
}
