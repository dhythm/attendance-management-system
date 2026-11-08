import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/errors";
import { attendanceRecords, users } from "@/server/db/schema";

async function insertUser() {
  const db = await getDb();
  const [user] = await db
    .insert(users)
    .values({ loginId: `db-${randomUUID()}`, passwordHash: "x", displayName: "テスト" })
    .returning();
  if (!user) throw new Error("user not inserted");
  return user;
}

describe("database", () => {
  it("is migrated and round-trips rows", async () => {
    const user = await insertUser();
    const db = await getDb();
    const rows = await db.select().from(users);
    expect(rows.map((r) => r.id)).toContain(user.id);
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it("rejects a second open attendance record for the same user as a unique violation", async () => {
    const user = await insertUser();
    const db = await getDb();
    await db.insert(attendanceRecords).values({ userId: user.id, clockInAt: new Date() });
    const error = await db
      .insert(attendanceRecords)
      .values({ userId: user.id, clockInAt: new Date() })
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(isUniqueViolation(error)).toBe(true);
  });

  it("does not classify other errors as unique violations", () => {
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
