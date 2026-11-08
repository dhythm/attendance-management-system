import { and, asc, desc, eq, gt, gte, isNull, lt, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { type SourcedShift, timeSources } from "@/domain/attendance";
import type { UserId } from "@/domain/user";
import type { Db } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/errors";
import { attendanceRecordEdits, attendanceRecords, users } from "@/server/db/schema";

export type AttendanceRecordId = string & { readonly __brand: "AttendanceRecordId" };

const recordIdSchema = z.uuid().transform((id) => id as AttendanceRecordId);
const userIdSchema = z.uuid().transform((id) => id as UserId);

export function parseRecordId(raw: string): AttendanceRecordId | null {
  const parsed = recordIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const recordRow = z.object({
  id: recordIdSchema,
  clockInAt: z.date(),
  clockOutAt: z.date().nullable(),
  clockInSource: z.enum(timeSources),
  clockOutSource: z.enum(timeSources).nullable(),
});
export type AttendanceRecord = z.infer<typeof recordRow>;

const columns = {
  id: attendanceRecords.id,
  clockInAt: attendanceRecords.clockInAt,
  clockOutAt: attendanceRecords.clockOutAt,
  clockInSource: attendanceRecords.clockInSource,
  clockOutSource: attendanceRecords.clockOutSource,
};

const listedRow = recordRow.extend({ editCount: z.number().int() });
export type ListedAttendanceRecord = z.infer<typeof listedRow>;

// Drizzle leaves columns unqualified in single-table queries, where a bare "id" here would bind
// to the edits table, so the outer record's id is spelled out.
const editCount = sql<number>`(
  SELECT count(*) FROM ${attendanceRecordEdits}
  WHERE ${attendanceRecordEdits.recordId} = "attendance_records"."id"
)`.mapWith(Number);

const isOpen = (userId: UserId) =>
  and(eq(attendanceRecords.userId, userId), isNull(attendanceRecords.clockOutAt));

export async function findOpenRecord(db: Db, userId: UserId): Promise<AttendanceRecord | null> {
  const [row] = await db.select(columns).from(attendanceRecords).where(isOpen(userId)).limit(1);
  return row ? recordRow.parse(row) : null;
}

export async function insertOpenRecord(
  db: Db,
  userId: UserId,
  clockInAt: Date,
): Promise<"OK" | "ALREADY_WORKING"> {
  try {
    await db.insert(attendanceRecords).values({ userId, clockInAt });
    return "OK";
  } catch (error) {
    if (isUniqueViolation(error)) return "ALREADY_WORKING";
    throw error;
  }
}

export async function closeOpenRecord(
  db: Db,
  userId: UserId,
  clockOutAt: Date,
): Promise<"OK" | "NOT_WORKING"> {
  const closed = await db
    .update(attendanceRecords)
    .set({ clockOutAt, clockOutSource: "clock" })
    .where(isOpen(userId))
    .returning({ id: attendanceRecords.id });
  return closed.length > 0 ? "OK" : "NOT_WORKING";
}

export async function listRecordsClockedInBetween(
  db: Db,
  userId: UserId,
  range: { start: Date; end: Date },
): Promise<ListedAttendanceRecord[]> {
  const rows = await db
    .select({ ...columns, editCount })
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.userId, userId),
        gte(attendanceRecords.clockInAt, range.start),
        lt(attendanceRecords.clockInAt, range.end),
      ),
    )
    .orderBy(asc(attendanceRecords.clockInAt));
  return rows.map((row) => listedRow.parse(row));
}

const withUserId = recordRow.extend({ userId: userIdSchema });
export type UserAttendanceRecord = z.infer<typeof withUserId>;

const columnsWithUserId = { ...columns, userId: attendanceRecords.userId };

export async function listAllOpenRecords(db: Db): Promise<UserAttendanceRecord[]> {
  const rows = await db
    .select(columnsWithUserId)
    .from(attendanceRecords)
    .where(isNull(attendanceRecords.clockOutAt));
  return rows.map((row) => withUserId.parse(row));
}

export async function listAllRecordsClockedInBetween(
  db: Db,
  range: { start: Date; end: Date },
): Promise<UserAttendanceRecord[]> {
  const rows = await db
    .select(columnsWithUserId)
    .from(attendanceRecords)
    .where(
      and(
        gte(attendanceRecords.clockInAt, range.start),
        lt(attendanceRecords.clockInAt, range.end),
      ),
    )
    .orderBy(asc(attendanceRecords.clockInAt));
  return rows.map((row) => withUserId.parse(row));
}

export async function findRecordOwner(db: Db, id: AttendanceRecordId): Promise<UserId | null> {
  const [row] = await db
    .select({ userId: attendanceRecords.userId })
    .from(attendanceRecords)
    .where(eq(attendanceRecords.id, id))
    .limit(1);
  return row ? userIdSchema.parse(row.userId) : null;
}

export async function lockUserAttendance(db: Db, userId: UserId): Promise<void> {
  await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
}

export async function lockRecord(db: Db, id: AttendanceRecordId): Promise<AttendanceRecord | null> {
  const [row] = await db
    .select(columns)
    .from(attendanceRecords)
    .where(eq(attendanceRecords.id, id))
    .for("update");
  return row ? recordRow.parse(row) : null;
}

export async function listOtherRecordsOverlapping(
  db: Db,
  userId: UserId,
  excludeId: AttendanceRecordId,
  range: { start: Date; end: Date },
): Promise<AttendanceRecord[]> {
  const rows = await db
    .select(columns)
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.userId, userId),
        ne(attendanceRecords.id, excludeId),
        lt(attendanceRecords.clockInAt, range.end),
        or(isNull(attendanceRecords.clockOutAt), gt(attendanceRecords.clockOutAt, range.start)),
      ),
    );
  return rows.map((row) => recordRow.parse(row));
}

export async function saveRecordEdit(
  db: Db,
  edit: {
    record: AttendanceRecord;
    next: SourcedShift;
    editorId: UserId;
    reason: string;
    at: Date;
  },
): Promise<ListedAttendanceRecord> {
  await db.insert(attendanceRecordEdits).values({
    recordId: edit.record.id,
    editorUserId: edit.editorId,
    previousClockInAt: edit.record.clockInAt,
    previousClockOutAt: edit.record.clockOutAt,
    newClockInAt: edit.next.clockInAt,
    newClockOutAt: edit.next.clockOutAt,
    reason: edit.reason,
    createdAt: edit.at,
  });
  const [row] = await db
    .update(attendanceRecords)
    .set(edit.next)
    .where(eq(attendanceRecords.id, edit.record.id))
    .returning({ ...columns, editCount });
  return listedRow.parse(row);
}

const editRow = z.object({
  id: z.uuid(),
  editorId: userIdSchema,
  editorDisplayName: z.string(),
  previousClockInAt: z.date(),
  previousClockOutAt: z.date().nullable(),
  newClockInAt: z.date(),
  newClockOutAt: z.date().nullable(),
  reason: z.string(),
  createdAt: z.date(),
});
export type AttendanceRecordEdit = z.infer<typeof editRow>;

export async function listRecordEdits(
  db: Db,
  recordId: AttendanceRecordId,
): Promise<AttendanceRecordEdit[]> {
  const rows = await db
    .select({
      id: attendanceRecordEdits.id,
      editorId: users.id,
      editorDisplayName: users.displayName,
      previousClockInAt: attendanceRecordEdits.previousClockInAt,
      previousClockOutAt: attendanceRecordEdits.previousClockOutAt,
      newClockInAt: attendanceRecordEdits.newClockInAt,
      newClockOutAt: attendanceRecordEdits.newClockOutAt,
      reason: attendanceRecordEdits.reason,
      createdAt: attendanceRecordEdits.createdAt,
    })
    .from(attendanceRecordEdits)
    .innerJoin(users, eq(attendanceRecordEdits.editorUserId, users.id))
    .where(eq(attendanceRecordEdits.recordId, recordId))
    .orderBy(desc(attendanceRecordEdits.createdAt));
  return rows.map((row) => editRow.parse(row));
}
