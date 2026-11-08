"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/client/api-client";
import { queryKeys } from "@/client/query-keys";
import { shiftMonth, type YearMonth } from "@/domain/attendance";
import { formatDuration, formatTime, formatWorkDate, formatYearMonth } from "@/shared/format";

export function Dashboard({
  displayName,
  initialMonth,
}: {
  displayName: string;
  initialMonth: YearMonth;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    },
  });

  return (
    <main>
      <div className="header">
        <h1>勤怠管理</h1>
        <div>
          <span className="muted">{displayName} さん</span>{" "}
          <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
            ログアウト
          </button>
        </div>
      </div>
      {logout.error && (
        <p role="alert" className="error">
          {logout.error.message}
        </p>
      )}
      <StatusCard />
      <RecordsCard initialMonth={initialMonth} />
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

function RecordsCard({ initialMonth }: { initialMonth: YearMonth }) {
  const [month, setMonth] = useState(initialMonth);
  const records = useQuery({
    queryKey: queryKeys.records(month),
    queryFn: () => api.records(month),
  });

  return (
    <section className="card" aria-labelledby="records-heading">
      <div className="month-nav">
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))}>
          ← 前月
        </button>
        <h2 id="records-heading">{formatYearMonth(month)}の勤怠</h2>
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))}>
          翌月 →
        </button>
      </div>
      {records.error && (
        <p role="alert" className="error">
          {records.error.message}
        </p>
      )}
      {records.isPending && <p className="muted">読み込み中…</p>}
      {records.data && records.data.days.length === 0 && (
        <p className="muted">この月の記録はありません</p>
      )}
      {records.data && records.data.days.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>日付</th>
              <th>出勤〜退勤</th>
              <th className="number">勤務時間</th>
            </tr>
          </thead>
          <tbody>
            {records.data.days.map((day) => (
              <tr key={day.workDate}>
                <td>{formatWorkDate(day.workDate)}</td>
                <td>
                  {day.shifts.map((shift) => (
                    <div key={shift.id}>
                      {formatTime(shift.clockInAt)} 〜{" "}
                      {shift.clockOutAt ? formatTime(shift.clockOutAt) : "勤務中"}
                    </div>
                  ))}
                </td>
                <td className="number">{formatDuration(day.durationMs)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>合計</td>
              <td className="number" data-testid="monthly-total">
                {formatDuration(records.data.totalMs)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}
