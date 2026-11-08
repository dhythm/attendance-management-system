"use client";

import { api } from "@/client/api-client";
import { queryKeys } from "@/client/query-keys";
import type { YearMonth } from "@/domain/attendance";
import { RecordsCard } from "./records-card";

export function UserRecords({
  userId,
  initialMonth,
  canEdit,
}: {
  userId: string;
  initialMonth: YearMonth;
  canEdit: boolean;
}) {
  return (
    <RecordsCard
      initialMonth={initialMonth}
      queryKey={(month) => queryKeys.userRecords(userId, month)}
      load={(month) => api.userRecords(userId, month)}
      canEdit={canEdit}
    />
  );
}
