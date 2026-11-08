import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { type SourcedShift, type WorkDate, workDateOf } from "@/domain/attendance";
import type { Role } from "@/domain/role";
import { hashPassword } from "@/server/auth/password";
import { passwordSchema } from "@/shared/api";
import type { Db } from "./client";
import { attendanceRecordEdits, attendanceRecords, users } from "./schema";

type DemoAttendance = "none" | "pastWeekdays" | "pastWeekdaysAndWorkingNow";

type Shift = { clockInAt: Date; clockOutAt: Date | null };

type DemoEdit = { editorLoginId: string; reason: string; createdAt: Date; previous: Shift };

export type DemoShift = SourcedShift & { edit: DemoEdit | null };

type Correction = (planned: { start: number; end: number }, midnight: number) => DemoShift;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const PAST_DAYS = 14;

// Keyed by how many weekdays back the corrected shift is, so the edits land in the most recent
// days and show up in the current month's view.
const demoCorrections: Record<string, Record<number, Correction>> = {
  suzuki: {
    1: ({ start, end }, midnight) => ({
      clockInAt: new Date(start),
      clockOutAt: new Date(end),
      clockInSource: "clock",
      clockOutSource: "edit",
      edit: {
        editorLoginId: "suzuki",
        reason: "退勤の打刻忘れ",
        createdAt: new Date(midnight + 21 * HOUR + 10 * MINUTE),
        previous: { clockInAt: new Date(start), clockOutAt: null },
      },
    }),
  },
  yamada: {
    2: ({ start, end }, midnight) => ({
      clockInAt: new Date(start),
      clockOutAt: new Date(end),
      clockInSource: "edit",
      clockOutSource: "clock",
      edit: {
        editorLoginId: "manager",
        reason: "打刻時刻の誤り",
        createdAt: new Date(midnight + 12 * HOUR + 30 * MINUTE),
        previous: { clockInAt: new Date(start + 52 * MINUTE), clockOutAt: new Date(end) },
      },
    }),
  },
};

export const demoAccounts: readonly {
  loginId: string;
  displayName: string;
  role: Role;
  attendance: DemoAttendance;
}[] = [
  { loginId: "admin", displayName: "アドミン", role: "admin", attendance: "none" },
  {
    loginId: "manager",
    displayName: "マネージャー 佐藤",
    role: "manager",
    attendance: "pastWeekdays",
  },
  {
    loginId: "yamada",
    displayName: "山田 太郎",
    role: "employee",
    attendance: "pastWeekdaysAndWorkingNow",
  },
  { loginId: "suzuki", displayName: "鈴木 花子", role: "employee", attendance: "pastWeekdays" },
];

function tokyoMidnight(workDate: WorkDate): number {
  return new Date(`${workDate}T00:00:00+09:00`).getTime();
}

function isWeekend(workDate: WorkDate): boolean {
  const weekday = new Date(`${workDate}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

// FNV-1a: a stable pseudo-random value per account and day, so reruns produce the same data.
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

function minutesBetween(seed: number, min: number, max: number): number {
  return min + (seed % (max - min + 1));
}

function plannedDay(loginId: string, workDate: WorkDate): { start: number; end: number } {
  const midnight = tokyoMidnight(workDate);
  const seed = hash(`${loginId}:${workDate}`);
  return {
    start: midnight + 9 * HOUR + minutesBetween(seed, -20, 20) * MINUTE,
    end: midnight + 18 * HOUR + minutesBetween(seed >>> 8, -30, 60) * MINUTE,
  };
}

export function demoShifts(loginId: string, now: Date): DemoShift[] {
  const attendance = demoAccounts.find((a) => a.loginId === loginId)?.attendance ?? "none";
  if (attendance === "none") return [];

  const today = workDateOf(now);
  const pastWeekdays: WorkDate[] = [];
  for (let back = PAST_DAYS; back >= 1; back--) {
    const day = workDateOf(new Date(tokyoMidnight(today) - back * DAY));
    if (!isWeekend(day)) pastWeekdays.push(day);
  }
  const corrections = demoCorrections[loginId] ?? {};
  const shifts: DemoShift[] = pastWeekdays.map((day, index) => {
    const planned = plannedDay(loginId, day);
    const correct = corrections[pastWeekdays.length - index];
    if (correct) return correct(planned, tokyoMidnight(day));
    return {
      clockInAt: new Date(planned.start),
      clockOutAt: new Date(planned.end),
      clockInSource: "clock",
      clockOutSource: "clock",
      edit: null,
    };
  });
  if (attendance === "pastWeekdaysAndWorkingNow") {
    const clockInAt = Math.min(plannedDay(loginId, today).start, now.getTime() - HOUR);
    shifts.push({
      clockInAt: new Date(Math.max(tokyoMidnight(today), clockInAt)),
      clockOutAt: null,
      clockInSource: "clock",
      clockOutSource: null,
      edit: null,
    });
  }
  return shifts;
}

export function readSeedPassword(env: Record<string, string | undefined>): string {
  const password = env.SEED_PASSWORD;
  if (!password) {
    throw new Error("SEED_PASSWORD を設定してください（デモアカウント共通のパスワードです）");
  }
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) {
    throw new Error(`SEED_PASSWORD が不正です: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}

// Demo accounts are upserted by login ID and their attendance is replaced wholesale, so every
// run converges to the same data for the given `now`, whatever an earlier run left behind.
export async function seedDemoData(db: Db, options: { password: string; now: Date }) {
  const accounts = await Promise.all(
    demoAccounts.map(async (account) => ({
      ...account,
      passwordHash: await hashPassword(options.password),
    })),
  );
  await db.transaction(async (tx) => {
    const userIds = new Map<string, string>();
    for (const { loginId, displayName, role, passwordHash } of accounts) {
      const [row] = await tx
        .insert(users)
        .values({ loginId, displayName, role, passwordHash })
        .onConflictDoUpdate({ target: users.loginId, set: { displayName, role, passwordHash } })
        .returning({ id: users.id });
      if (!row) throw new Error(`failed to upsert demo account ${loginId}`);
      await tx.delete(attendanceRecords).where(eq(attendanceRecords.userId, row.id));
      userIds.set(loginId, row.id);
    }

    const records: (typeof attendanceRecords.$inferInsert)[] = [];
    const edits: (typeof attendanceRecordEdits.$inferInsert)[] = [];
    for (const [loginId, userId] of userIds) {
      for (const { edit, ...shift } of demoShifts(loginId, options.now)) {
        const id = randomUUID();
        records.push({ ...shift, id, userId });
        if (!edit) continue;
        const editorUserId = userIds.get(edit.editorLoginId);
        if (!editorUserId) throw new Error(`unknown demo editor ${edit.editorLoginId}`);
        edits.push({
          recordId: id,
          editorUserId,
          previousClockInAt: edit.previous.clockInAt,
          previousClockOutAt: edit.previous.clockOutAt,
          newClockInAt: shift.clockInAt,
          newClockOutAt: shift.clockOutAt,
          reason: edit.reason,
          createdAt: edit.createdAt,
        });
      }
    }
    if (records.length > 0) await tx.insert(attendanceRecords).values(records);
    if (edits.length > 0) await tx.insert(attendanceRecordEdits).values(edits);
  });
}
