"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Hourglass, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/client/api-client";
import { queryKeys } from "@/client/query-keys";
import type { YearMonth } from "@/domain/attendance";
import { formatDuration, formatTime } from "@/shared/format";
import { Avatar, RoleBadge } from "./identity";
import { MonthSwitcher } from "./month-switcher";

export function UsersOverview({ initialMonth }: { initialMonth: YearMonth }) {
  const [month, setMonth] = useState(initialMonth);
  const overview = useQuery({
    queryKey: queryKeys.usersOverview(month),
    queryFn: () => api.usersOverview(month),
  });
  const users = overview.data?.users ?? [];
  const workingCount = users.filter((user) => user.status.kind === "working").length;
  const total = users.reduce((sum, user) => sum + user.totalMs, 0);
  const longest = Math.max(1, ...users.map((user) => user.totalMs));

  return (
    <>
      <div className="summary">
        <div className="card">
          <span className="summary-icon working">
            <Activity size={18} />
          </span>
          <div className="stat">
            <span className="stat-label">いま勤務中</span>
            <span className="stat-value num">
              {workingCount}
              <small>/ {users.length} 人</small>
            </span>
          </div>
        </div>
        <div className="card">
          <span className="summary-icon">
            <Hourglass size={18} />
          </span>
          <div className="stat">
            <span className="stat-label">月の総勤務時間</span>
            <span className="stat-value num">{formatDuration(total)}</span>
          </div>
        </div>
        <div className="card">
          <span className="summary-icon">
            <TrendingUp size={18} />
          </span>
          <div className="stat">
            <span className="stat-label">1人あたり平均</span>
            <span className="stat-value num">
              {formatDuration(users.length > 0 ? total / users.length : 0)}
            </span>
          </div>
        </div>
      </div>

      <section className="card" aria-labelledby="overview-heading">
        <div className="card-header">
          <span className="card-title">
            <Users size={17} />
            メンバー
          </span>
          <MonthSwitcher
            month={month}
            onChange={setMonth}
            headingId="overview-heading"
            suffix="の勤怠一覧"
          />
        </div>
        {overview.error && (
          <div className="card-body">
            <p role="alert" className="alert">
              {overview.error.message}
            </p>
          </div>
        )}
        {overview.isPending && <p className="placeholder">読み込み中…</p>}
        {overview.data && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>メンバー</th>
                  <th>権限</th>
                  <th>現在の状況</th>
                  <th className="number">月の勤務時間</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <Link href={`/manager/users/${user.id}`} className="person">
                        <Avatar name={user.displayName} seed={user.id} />
                        <span>
                          <span className="person-name">{user.displayName}</span>
                          <br />
                          <span className="person-id">{user.loginId}</span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <RoleBadge role={user.role} />
                    </td>
                    <td>
                      {user.status.kind === "working" ? (
                        <span className="elapsed num">
                          <span className="pill working">
                            <span className="dot" />
                            勤務中
                          </span>
                          {formatTime(user.status.since)} 出勤
                        </span>
                      ) : (
                        <span className="pill">
                          <span className="dot" />
                          勤務外
                        </span>
                      )}
                    </td>
                    <td className="number">
                      <div className="hours-bar">
                        <span className="duration num">{formatDuration(user.totalMs)}</span>
                        <span className="hours-track" aria-hidden="true">
                          <span
                            className="hours-fill"
                            style={{
                              display: "block",
                              width: `${(user.totalMs / longest) * 100}%`,
                            }}
                          />
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
