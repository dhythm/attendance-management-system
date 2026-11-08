export const queryKeys = {
  attendance: ["attendance"] as const,
  status: () => [...queryKeys.attendance, "status"] as const,
  records: (month: string) => [...queryKeys.attendance, "records", month] as const,
  usersOverview: (month: string) => [...queryKeys.attendance, "users", month] as const,
  userRecords: (userId: string, month: string) =>
    [...queryKeys.attendance, "users", userId, "records", month] as const,
};
