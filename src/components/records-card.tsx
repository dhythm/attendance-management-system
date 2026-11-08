"use client";

import { type QueryKey, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { shiftMonth, type YearMonth } from "@/domain/attendance";
import type { RecordsResponse } from "@/shared/api";
import { formatDuration, formatTime, formatWorkDate, formatYearMonth } from "@/shared/format";

export function RecordsCard({
  initialMonth,
  queryKey,
  load,
}: {
  initialMonth: YearMonth;
  queryKey: (month: YearMonth) => QueryKey;
  load: (month: YearMonth) => Promise<RecordsResponse>;
}) {
  const [month, setMonth] = useState(initialMonth);
  const records = useQuery({ queryKey: queryKey(month), queryFn: () => load(month) });

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
