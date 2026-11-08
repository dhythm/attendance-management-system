import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timeSources } from "@/domain/attendance";
import { roles } from "@/domain/role";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

const oneOf = (values: readonly string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(", "));

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loginId: text("login_id").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: roles }).notNull().default("employee"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [check("users_role_valid", sql`${t.role} IN (${oneOf(roles)})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clockInAt: timestamptz("clock_in_at").notNull(),
    clockOutAt: timestamptz("clock_out_at"),
    clockInSource: text("clock_in_source", { enum: timeSources }).notNull().default("clock"),
    clockOutSource: text("clock_out_source", { enum: timeSources }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("attendance_records_one_open_per_user")
      .on(t.userId)
      .where(sql`${t.clockOutAt} IS NULL`),
    index("attendance_records_user_clock_in_idx").on(t.userId, t.clockInAt),
    check(
      "attendance_records_clock_out_after_clock_in",
      sql`${t.clockOutAt} IS NULL OR ${t.clockOutAt} > ${t.clockInAt}`,
    ),
    check(
      "attendance_records_clock_in_source_valid",
      sql`${t.clockInSource} IN (${oneOf(timeSources)})`,
    ),
    check(
      "attendance_records_clock_out_source_valid",
      sql`${t.clockOutSource} IN (${oneOf(timeSources)})`,
    ),
    check(
      "attendance_records_clock_out_source_iff_clock_out",
      sql`(${t.clockOutAt} IS NULL) = (${t.clockOutSource} IS NULL)`,
    ),
  ],
);

// Append-only audit log: the app inserts a row per edit and never updates or deletes one.
export const attendanceRecordEdits = pgTable(
  "attendance_record_edits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordId: uuid("record_id")
      .notNull()
      .references(() => attendanceRecords.id, { onDelete: "cascade" }),
    editorUserId: uuid("editor_user_id")
      .notNull()
      .references(() => users.id),
    previousClockInAt: timestamptz("previous_clock_in_at").notNull(),
    previousClockOutAt: timestamptz("previous_clock_out_at"),
    newClockInAt: timestamptz("new_clock_in_at").notNull(),
    newClockOutAt: timestamptz("new_clock_out_at"),
    reason: text("reason").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("attendance_record_edits_record_created_idx").on(t.recordId, t.createdAt),
    check("attendance_record_edits_reason_not_blank", sql`char_length(btrim(${t.reason})) > 0`),
  ],
);
