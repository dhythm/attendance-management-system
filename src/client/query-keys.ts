export const queryKeys = {
  attendance: ["attendance"] as const,
  status: () => [...queryKeys.attendance, "status"] as const,
  records: (month: string) => [...queryKeys.attendance, "records", month] as const,
};
