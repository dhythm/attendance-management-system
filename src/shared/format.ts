import type { Role } from "@/domain/role";

const timeFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dateTimeFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const clockFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

const JST_OFFSET_MS = 9 * 3_600_000;
const DAY_MS = 24 * 3_600_000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${pad(minutes)}`;
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  return `${hours}:${pad(Math.floor(totalSeconds / 60) % 60)}:${pad(totalSeconds % 60)}`;
}

export function formatClock(date: Date): string {
  return clockFormat.format(date);
}

export function formatLongDate(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  return `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日（${weekdays[jst.getUTCDay()]}）`;
}

export function minutesOfDay(iso: string): number {
  const ms = (new Date(iso).getTime() + JST_OFFSET_MS) % DAY_MS;
  return Math.floor(ms / 60_000);
}

export function isWeekend(workDate: string): boolean {
  const day = new Date(`${workDate}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

export function toTokyoDateTimeLocal(iso: string): string {
  return new Date(new Date(iso).getTime() + JST_OFFSET_MS).toISOString().slice(0, 16);
}

export function fromTokyoDateTimeLocal(value: string): string {
  return `${value}:00+09:00`;
}

export function formatWorkDate(workDate: string): string {
  const date = new Date(`${workDate}T00:00:00Z`);
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}(${weekdays[date.getUTCDay()]})`;
}

export function formatYearMonth(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `${year}年${Number(monthNumber)}月`;
}

export const roleLabels: Record<Role, string> = {
  employee: "一般社員",
  manager: "マネージャー",
  admin: "アドミン",
};
