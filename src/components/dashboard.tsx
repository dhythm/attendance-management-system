"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/client/api-client";
import { queryKeys } from "@/client/query-keys";
import type { YearMonth } from "@/domain/attendance";
import type { User } from "@/domain/user";
import { formatTime } from "@/shared/format";
import { AppHeader } from "./app-header";
import { RecordsCard } from "./records-card";

export function Dashboard({ user, initialMonth }: { user: User; initialMonth: YearMonth }) {
  return (
    <main>
      <AppHeader user={user} />
      <StatusCard />
      <RecordsCard initialMonth={initialMonth} queryKey={queryKeys.records} load={api.records} />
    </main>
  );
}

function StatusCard() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: queryKeys.status(), queryFn: api.status });
  const clock = useMutation({
    mutationFn: (action: "clockIn" | "clockOut") => api[action](),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.status(), data),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.attendance }),
  });

  const current = status.data?.status;
  return (
    <section className="card" aria-labelledby="status-heading">
      <h2 id="status-heading" className="muted">
        現在の状況
      </h2>
      {status.error && (
        <p role="alert" className="error">
          {status.error.message}
        </p>
      )}
      {clock.error && (
        <p role="alert" className="error">
          {clock.error.message}
        </p>
      )}
      <div className="status-row">
        <p
          className={`status ${current?.kind === "working" ? "working" : ""}`}
          data-testid="status"
        >
          {!current && "読み込み中…"}
          {current?.kind === "off_duty" && "勤務外"}
          {current?.kind === "working" && `勤務中（${formatTime(current.since)} 出勤）`}
        </p>
        {current && (
          <button
            type="button"
            className="primary clock-button"
            disabled={clock.isPending}
            onClick={() => clock.mutate(current.kind === "working" ? "clockOut" : "clockIn")}
          >
            {current.kind === "working" ? "退勤" : "出勤"}
          </button>
        )}
      </div>
    </section>
  );
}
