"use client";

import { type QueryKey, useQuery } from "@tanstack/react-query";
import {
  CalendarCheck,
  CalendarDays,
  CalendarX2,
  Hourglass,
  Pencil,
  PencilLine,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { type TimeSource, workDateOf, type YearMonth } from "@/domain/attendance";
import type { RecordsResponse } from "@/shared/api";
import {
  formatDuration,
  formatTime,
  formatWorkDate,
  isWeekend,
  minutesOfDay,
} from "@/shared/format";
import { EditRecordDialog } from "./edit-record-dialog";
import { MonthSwitcher } from "./month-switcher";
import { useNow } from "./use-now";

type Day = RecordsResponse["days"][number];
type Shift = Day["shifts"][number];

const MINUTES_PER_DAY = 24 * 60;

function shiftSpan(shift: Shift, now: Date | null): { left: number; width: number } {
  const start = minutesOfDay(shift.clockInAt);
  const endIso = shift.clockOutAt ?? now?.toISOString() ?? shift.clockInAt;
  const rawEnd = minutesOfDay(endIso);
  const end = rawEnd < start ? MINUTES_PER_DAY : rawEnd;
  return {
    left: (start / MINUTES_PER_DAY) * 100,
    width: ((end - start) / MINUTES_PER_DAY) * 100,
  };
}

function Timeline({ shifts, now }: { shifts: Shift[]; now: Date | null }) {
  return (
    <div className="timeline" aria-hidden="true">
      {shifts.map((shift) => {
        const { left, width } = shiftSpan(shift, now);
        return (
          <span
            key={shift.id}
            className={shift.clockOutAt ? "timeline-shift" : "timeline-shift live"}
            style={{ left: `${left}%`, width: `${width}%` }}
          />
        );
      })}
    </div>
  );
}

function SourceTag({ source }: { source: TimeSource | null }) {
  return source === "edit" ? (
    <span className="source-tag edit">
      <Pencil size={10} aria-hidden="true" />
      編集
    </span>
  ) : (
    <span className="source-tag">打刻</span>
  );
}

function ShiftTimes({ day, onEdit }: { day: Day; onEdit: ((shift: Shift) => void) | null }) {
  const date = formatWorkDate(day.workDate);
  return (
    <div className="shift-times num">
      {day.shifts.map((shift) => (
        <span key={shift.id} className={shift.clockOutAt ? "shift-line" : "shift-line live"}>
          {formatTime(shift.clockInAt)} <SourceTag source={shift.clockInSource} /> 〜{" "}
          {shift.clockOutAt ? (
            <>
              {formatTime(shift.clockOutAt)} <SourceTag source={shift.clockOutSource} />
            </>
          ) : (
            "勤務中"
          )}
          {onEdit && (
            <button
              type="button"
              className="icon-button small"
              aria-label={
                day.shifts.length > 1
                  ? `${date} ${formatTime(shift.clockInAt)}〜の勤怠を修正`
                  : `${date}の勤怠を修正`
              }
              onClick={() => onEdit(shift)}
            >
              <PencilLine size={14} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

function Stats({ data }: { data: RecordsResponse }) {
  const completedDays = data.days.filter((day) => day.durationMs > 0).length;
  const average = completedDays > 0 ? data.totalMs / completedDays : 0;
  return (
    <div className="stats">
      <div className="stat">
        <span className="stat-label">
          <Hourglass size={14} />
          合計勤務時間
        </span>
        <span className="stat-value num" data-testid="monthly-total">
          {formatDuration(data.totalMs)}
        </span>
      </div>
      <div className="stat">
        <span className="stat-label">
          <CalendarCheck size={14} />
          出勤日数
        </span>
        <span className="stat-value num">
          {data.days.length}
          <small>日</small>
        </span>
      </div>
      <div className="stat">
        <span className="stat-label">
          <TrendingUp size={14} />
          1日あたり平均
        </span>
        <span className="stat-value num">{formatDuration(average)}</span>
      </div>
    </div>
  );
}

export function RecordsCard({
  initialMonth,
  queryKey,
  load,
  canEdit,
}: {
  initialMonth: YearMonth;
  queryKey: (month: YearMonth) => QueryKey;
  load: (month: YearMonth) => Promise<RecordsResponse>;
  canEdit: boolean;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [editing, setEditing] = useState<{ shift: Shift; workDate: string } | null>(null);
  const now = useNow(30_000);
  const records = useQuery({ queryKey: queryKey(month), queryFn: () => load(month) });
  const today = now ? workDateOf(now) : null;

  return (
    <section className="card" aria-labelledby="records-heading">
      <div className="card-header">
        <span className="card-title">
          <CalendarDays size={17} />
          勤怠記録
        </span>
        <MonthSwitcher
          month={month}
          onChange={setMonth}
          headingId="records-heading"
          suffix="の勤怠"
        />
      </div>
      {records.error && (
        <div className="card-body">
          <p role="alert" className="alert">
            {records.error.message}
          </p>
        </div>
      )}
      {records.isPending && <p className="placeholder">読み込み中…</p>}
      {records.data && <Stats data={records.data} />}
      {records.data && records.data.days.length === 0 && (
        <div className="empty">
          <CalendarX2 size={28} />
          この月の記録はありません
        </div>
      )}
      {records.data && records.data.days.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>日付</th>
                <th>出勤 〜 退勤</th>
                <th className="number">勤務時間</th>
                <th>
                  <div className="timeline-scale num" aria-hidden="true">
                    {[0, 4, 8, 12, 16, 20, 24].map((hour) => (
                      <span key={hour}>{hour}</span>
                    ))}
                  </div>
                  <span className="sr-only">タイムライン</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {records.data.days.map((day) => (
                <tr key={day.workDate}>
                  <td>
                    <span className={`date-cell num ${isWeekend(day.workDate) ? "weekend" : ""}`}>
                      {formatWorkDate(day.workDate)}
                      {day.workDate === today && <span className="today-chip">今日</span>}
                    </span>
                  </td>
                  <td>
                    <ShiftTimes
                      day={day}
                      onEdit={
                        canEdit ? (shift) => setEditing({ shift, workDate: day.workDate }) : null
                      }
                    />
                  </td>
                  <td className="number">
                    <span className="duration num">{formatDuration(day.durationMs)}</span>
                  </td>
                  <td>
                    <Timeline shifts={day.shifts} now={now} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <EditRecordDialog
          key={editing.shift.id}
          shift={editing.shift}
          workDate={editing.workDate}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
