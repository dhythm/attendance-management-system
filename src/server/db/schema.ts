import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { roles } from "@/domain/role";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

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
  (t) => [
    check(
      "users_role_valid",
      sql`${t.role} IN (${sql.raw(roles.map((role) => `'${role}'`).join(", "))})`,
    ),
  ],
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
  ],
);
