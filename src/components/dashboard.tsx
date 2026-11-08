"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, LogIn, LogOut, Timer } from "lucide-react";
import { api } from "@/client/api-client";
import { queryKeys } from "@/client/query-keys";
import type { YearMonth } from "@/domain/attendance";
import { canEditAttendance } from "@/domain/role";
import type { User } from "@/domain/user";
import { formatClock, formatElapsed, formatLongDate, formatTime } from "@/shared/format";
import { AppShell } from "./app-shell";
import { RecordsCard } from "./records-card";
import { useNow } from "./use-now";

export function Dashboard({ user, initialMonth }: { user: User; initialMonth: YearMonth }) {
  return (
    <AppShell user={user}>
      <ClockHero user={user} />
      <RecordsCard
        initialMonth={initialMonth}
        queryKey={queryKeys.records}
        load={api.records}
        canEdit={canEditAttendance(user.role, true)}
      />
    </AppShell>
  );
}

function greeting(now: Date | null): string {
  if (!now) return "ようこそ";
  const hour = Number(formatClock(now).slice(0, 2));
  if (hour < 11) return "おはようございます";
  if (hour < 18) return "こんにちは";
  return "おつかれさまです";
}

export function LiveClock({ now }: { now: Date | null }) {
  const [hhmm, seconds] = now
    ? [formatClock(now).slice(0, 5), formatClock(now).slice(5)]
    : ["--:--", ":--"];
  return (
    <>
      {hhmm}
      <span className="seconds">{seconds}</span>
    </>
  );
}

function ClockHero({ user }: { user: User }) {
  const now = useNow();
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: queryKeys.status(), queryFn: api.status });
  const clock = useMutation({
    mutationFn: (action: "clockIn" | "clockOut") => api[action](),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.status(), data),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.attendance }),
  });

  const current = status.data?.status;
  const working = current?.kind === "working";

  return (
    <section
      className={`card hero ${working ? "is-working" : ""}`}
      aria-labelledby="status-heading"
    >
      <div>
        <p className="hero-date">
          <CalendarDays size={15} />
          {now ? formatLongDate(now) : " "}
        </p>
        <h2 id="status-heading" className="hero-greeting">
          {greeting(now)}、{user.displayName} さん
        </h2>
        <p className="hero-clock num" aria-hidden="true">
          <LiveClock now={now} />
        </p>
        {status.error && (
          <p role="alert" className="alert">
            {status.error.message}
          </p>
        )}
        {clock.error && (
          <p role="alert" className="alert">
            {clock.error.message}
          </p>
        )}
        <div className="hero-status">
          <span className={`pill ${working ? "working" : ""}`}>
            <span className="dot" />
            <span data-testid="status">
              {!current && "読み込み中…"}
              {current?.kind === "off_duty" && "勤務外"}
              {current?.kind === "working" && "勤務中"}
            </span>
          </span>
          {current?.kind === "working" && (
            <span className="elapsed num">
              <Timer size={15} />
              {formatTime(current.since)} 出勤
              {now && (
                <>
                  ・経過 <strong>{formatElapsed(now.getTime() - Date.parse(current.since))}</strong>
                </>
              )}
            </span>
          )}
        </div>
      </div>
      {current && (
        <div className="clock-action">
          <button
            type="button"
            className={`clock-button ${working ? "out" : ""}`}
            disabled={clock.isPending}
            onClick={() => clock.mutate(working ? "clockOut" : "clockIn")}
          >
            {working ? (
              <LogOut size={28} aria-hidden="true" />
            ) : (
              <LogIn size={28} aria-hidden="true" />
            )}
            {working ? "退勤" : "出勤"}
          </button>
          <span className="clock-hint">
            {working ? "おつかれさまでした。押すと退勤を記録します" : "押すと出勤を記録します"}
          </span>
        </div>
      )}
    </section>
  );
}
