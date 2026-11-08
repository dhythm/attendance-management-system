import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as clockIn } from "@/app/api/attendance/clock-in/route";
import { POST as clockOut } from "@/app/api/attendance/clock-out/route";
import { GET as userRecords } from "@/app/api/manager/users/[id]/records/route";
import { GET as usersOverview } from "@/app/api/manager/users/route";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { call, createAccount } from "./helpers";

const jst = (iso: string) => new Date(`${iso}+09:00`);
const HOUR = 3_600_000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(jst("2026-11-10T12:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

async function shift(cookie: string, from: string, to: string) {
  vi.setSystemTime(jst(from));
  expect((await call(clockIn, "/api/attendance/clock-in", { method: "POST", cookie })).status).toBe(
    201,
  );
  vi.setSystemTime(jst(to));
  expect(
    (await call(clockOut, "/api/attendance/clock-out", { method: "POST", cookie })).status,
  ).toBe(200);
}

type OverviewRow = { id: string; status: { kind: string }; totalMs: number };

describe("manager API authorization", () => {
  it("returns 401 without a session", async () => {
    const result = await call(usersOverview, "/api/manager/users");
    expect(result.status).toBe(401);
  });

  it("returns 403 to an employee", async () => {
    const employee = await createAccount("employee");
    const other = await createAccount("employee");

    const overview = await call(usersOverview, "/api/manager/users", { cookie: employee.cookie });
    const records = await call(userRecords, `/api/manager/users/${other.user.id}/records`, {
      cookie: employee.cookie,
      params: { id: other.user.id },
    });

    expect(overview.status).toBe(403);
    expect(overview.json.error.code).toBe("FORBIDDEN");
    expect(records.status).toBe(403);
    expect(records.json.error.code).toBe("FORBIDDEN");
  });

  it.each(["manager", "admin"] as const)("allows a %s", async (role) => {
    const { cookie } = await createAccount(role);
    expect((await call(usersOverview, "/api/manager/users", { cookie })).status).toBe(200);
  });

  it("applies a role change on the very next request", async () => {
    const employee = await createAccount("employee");
    expect(
      (await call(usersOverview, "/api/manager/users", { cookie: employee.cookie })).status,
    ).toBe(403);

    await (await getDb())
      .update(users)
      .set({ role: "manager" })
      .where(eq(users.id, employee.user.id));

    expect(
      (await call(usersOverview, "/api/manager/users", { cookie: employee.cookie })).status,
    ).toBe(200);
  });
});

describe("GET /api/manager/users", () => {
  it("shows every user's current status and closed work time for the month", async () => {
    const manager = await createAccount("manager");
    const working = await createAccount("employee");
    const offDuty = await createAccount("employee");
    await shift(working.cookie, "2026-11-09T09:00:00", "2026-11-09T18:00:00");
    await shift(offDuty.cookie, "2026-10-30T09:00:00", "2026-10-30T17:00:00");
    await shift(offDuty.cookie, "2026-11-02T09:00:00", "2026-11-02T12:30:00");
    vi.setSystemTime(jst("2026-11-10T09:00:00"));
    await call(clockIn, "/api/attendance/clock-in", { method: "POST", cookie: working.cookie });

    vi.setSystemTime(jst("2026-11-10T12:00:00"));
    const result = await call(usersOverview, "/api/manager/users?month=2026-11", {
      cookie: manager.cookie,
    });

    expect(result.status).toBe(200);
    expect(result.json.month).toBe("2026-11");
    const rows: OverviewRow[] = result.json.users;
    expect(rows.find((u) => u.id === working.user.id)).toMatchObject({
      loginId: working.loginId,
      displayName: working.user.displayName,
      role: "employee",
      status: { kind: "working", since: "2026-11-10T00:00:00.000Z" },
      totalMs: 9 * HOUR,
    });
    expect(rows.find((u) => u.id === offDuty.user.id)).toMatchObject({
      status: { kind: "off_duty" },
      totalMs: 3.5 * HOUR,
    });
    expect(rows.find((u) => u.id === manager.user.id)).toMatchObject({
      role: "manager",
      status: { kind: "off_duty" },
      totalMs: 0,
    });
  });

  it("defaults to the current month in Asia/Tokyo", async () => {
    vi.setSystemTime(new Date("2026-11-30T15:30:00Z"));
    const { cookie } = await createAccount("manager");
    const result = await call(usersOverview, "/api/manager/users", { cookie });
    expect(result.json.month).toBe("2026-12");
  });

  it("rejects an invalid month with 400", async () => {
    const { cookie } = await createAccount("manager");
    const result = await call(usersOverview, "/api/manager/users?month=2026-13", { cookie });
    expect(result.status).toBe(400);
    expect(result.json.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/manager/users/:id/records", () => {
  it("returns another user's monthly records grouped by day", async () => {
    const manager = await createAccount("manager");
    const employee = await createAccount("employee");
    await shift(employee.cookie, "2026-11-02T09:00:00", "2026-11-02T12:00:00");
    await shift(employee.cookie, "2026-11-02T13:00:00", "2026-11-02T18:00:00");
    await shift(employee.cookie, "2026-10-30T09:00:00", "2026-10-30T18:00:00");

    const result = await call(
      userRecords,
      `/api/manager/users/${employee.user.id}/records?month=2026-11`,
      { cookie: manager.cookie, params: { id: employee.user.id } },
    );

    expect(result.status).toBe(200);
    expect(result.json.month).toBe("2026-11");
    expect(
      result.json.days.map((d: { workDate: string; shifts: unknown[]; durationMs: number }) => [
        d.workDate,
        d.shifts.length,
        d.durationMs,
      ]),
    ).toEqual([["2026-11-02", 2, 8 * HOUR]]);
    expect(result.json.totalMs).toBe(8 * HOUR);
  });

  it.each([
    ["an unknown user", randomUUID()],
    ["a malformed id", "not-a-uuid"],
  ])("returns 404 for %s", async (_name, id) => {
    const { cookie } = await createAccount("manager");
    const result = await call(userRecords, `/api/manager/users/${id}/records`, {
      cookie,
      params: { id },
    });
    expect(result.status).toBe(404);
    expect(result.json.error.code).toBe("USER_NOT_FOUND");
  });
});
