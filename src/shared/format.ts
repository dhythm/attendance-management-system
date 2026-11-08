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

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
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
