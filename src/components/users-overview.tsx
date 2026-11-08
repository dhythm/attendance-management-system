"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/client/api-client";
import { queryKeys } from "@/client/query-keys";
import { shiftMonth, type YearMonth } from "@/domain/attendance";
import { formatDuration, formatTime, formatYearMonth, roleLabels } from "@/shared/format";

export function UsersOverview({ initialMonth }: { initialMonth: YearMonth }) {
  const [month, setMonth] = useState(initialMonth);
  const overview = useQuery({
    queryKey: queryKeys.usersOverview(month),
    queryFn: () => api.usersOverview(month),
  });

  return (
    <section className="card" aria-labelledby="overview-heading">
      <div className="month-nav">
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))}>
          ← 前月
        </button>
        <h2 id="overview-heading">{formatYearMonth(month)}の勤怠一覧</h2>
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))}>
          翌月 →
        </button>
      </div>
      {overview.error && (
        <p role="alert" className="error">
          {overview.error.message}
        </p>
      )}
      {overview.isPending && <p className="muted">読み込み中…</p>}
      {overview.data && (
        <table>
          <thead>
            <tr>
              <th>名前</th>
              <th>権限</th>
              <th>現在の状況</th>
              <th className="number">月の勤務時間</th>
            </tr>
          </thead>
          <tbody>
            {overview.data.users.map((user) => (
              <tr key={user.id}>
                <td>
                  <Link href={`/manager/users/${user.id}`}>{user.displayName}</Link>
                  <div className="hint">{user.loginId}</div>
                </td>
                <td>{roleLabels[user.role]}</td>
                <td>
                  {user.status.kind === "working" ? (
                    <span className="status-badge working">
                      勤務中（{formatTime(user.status.since)} 出勤）
                    </span>
                  ) : (
                    <span className="status-badge">勤務外</span>
                  )}
                </td>
                <td className="number">{formatDuration(user.totalMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
