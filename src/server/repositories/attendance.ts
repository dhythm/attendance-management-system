import { and, asc, eq, gte, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import type { UserId } from "@/domain/user";
import type { Db } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/errors";
import { attendanceRecords } from "@/server/db/schema";

export type AttendanceRecordId = string & { readonly __brand: "AttendanceRecordId" };

const recordRow = z.object({
  id: z.uuid().transform((id) => id as AttendanceRecordId),
  clockInAt: z.date(),
  clockOutAt: z.date().nullable(),
});
export type AttendanceRecord = z.infer<typeof recordRow>;

const columns = {
  id: attendanceRecords.id,
  clockInAt: attendanceRecords.clockInAt,
  clockOutAt: attendanceRecords.clockOutAt,
};

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
    .set({ clockOutAt })
    .where(isOpen(userId))
    .returning({ id: attendanceRecords.id });
  return closed.length > 0 ? "OK" : "NOT_WORKING";
}

export async function listRecordsClockedInBetween(
  db: Db,
  userId: UserId,
  range: { start: Date; end: Date },
): Promise<AttendanceRecord[]> {
  const rows = await db
    .select(columns)
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.userId, userId),
        gte(attendanceRecords.clockInAt, range.start),
        lt(attendanceRecords.clockInAt, range.end),
      ),
    )
    .orderBy(asc(attendanceRecords.clockInAt));
  return rows.map((row) => recordRow.parse(row));
}
