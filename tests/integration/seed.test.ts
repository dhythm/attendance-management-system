import { count, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { POST as clockIn } from "@/app/api/attendance/clock-in/route";
import { GET as me } from "@/app/api/me/route";
import { getDb } from "@/server/db/client";
import { attendanceRecords, users } from "@/server/db/schema";
import { demoAccounts, seedDemoData } from "@/server/db/seed";
import { call, logIn } from "./helpers";

const password = "seed-password-1234";
const demoLoginIds = demoAccounts.map((a) => a.loginId);

async function demoRowCounts() {
  const db = await getDb();
  const [userCount] = await db
    .select({ n: count() })
    .from(users)
    .where(inArray(users.loginId, demoLoginIds));
  const [recordCount] = await db
    .select({ n: count() })
    .from(attendanceRecords)
    .innerJoin(users, eq(attendanceRecords.userId, users.id))
    .where(inArray(users.loginId, demoLoginIds));
  return { users: userCount?.n, records: recordCount?.n };
}

describe("seedDemoData", () => {
  it("creates the demo accounts, each able to log in with its role", async () => {
    await seedDemoData(await getDb(), { password, now: new Date() });

    for (const [loginId, role] of [
      ["admin", "admin"],
      ["manager", "manager"],
      ["yamada", "employee"],
      ["suzuki", "employee"],
    ] as const) {
      const current = await call(me, "/api/me", { cookie: await logIn(loginId, password) });
      expect(current.json.user).toMatchObject({ loginId, role });
    }
  });

  it("yields identical row counts when run twice", async () => {
    const db = await getDb();
    const now = new Date();
    await seedDemoData(db, { password, now });
    const first = await demoRowCounts();
    await seedDemoData(db, { password, now });
    expect(await demoRowCounts()).toEqual(first);
    expect(first.users).toBe(4);
    expect(first.records).toBeGreaterThan(0);
  });

  it("resets demo attendance changed since the previous run", async () => {
    const db = await getDb();
    const now = new Date();
    await seedDemoData(db, { password, now });
    const seeded = await demoRowCounts();

    const cookie = await logIn("suzuki", password);
    expect(
      (await call(clockIn, "/api/attendance/clock-in", { method: "POST", cookie })).status,
    ).toBe(201);
    await seedDemoData(db, { password, now });
    expect(await demoRowCounts()).toEqual(seeded);
  });
});
