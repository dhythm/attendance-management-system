import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as clockIn } from "@/app/api/attendance/clock-in/route";
import { POST as clockOut } from "@/app/api/attendance/clock-out/route";
import { GET as recordEdits } from "@/app/api/attendance/records/[id]/edits/route";
import { PATCH as editRecord } from "@/app/api/attendance/records/[id]/route";
import { GET as records } from "@/app/api/attendance/records/route";
import { GET as status } from "@/app/api/attendance/status/route";
import { GET as userRecords } from "@/app/api/manager/users/[id]/records/route";
import { call, createAccount } from "./helpers";

const jst = (iso: string) => new Date(`${iso}+09:00`);
const utc = (iso: string) => jst(iso).toISOString();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(jst("2026-11-10T12:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

type ShiftJson = {
  id: string;
  clockInAt: string;
  clockOutAt: string | null;
  clockInSource: string;
  clockOutSource: string | null;
  editCount: number;
};

async function shift(cookie: string, from: string, to: string | null) {
  const now = new Date();
  vi.setSystemTime(jst(from));
  expect((await call(clockIn, "/api/attendance/clock-in", { method: "POST", cookie })).status).toBe(
    201,
  );
  if (to) {
    vi.setSystemTime(jst(to));
    expect(
      (await call(clockOut, "/api/attendance/clock-out", { method: "POST", cookie })).status,
    ).toBe(200);
  }
  vi.setSystemTime(now);
  const listed = await call(records, "/api/attendance/records?month=2026-11", { cookie });
  const shifts: ShiftJson[] = listed.json.days.flatMap((d: { shifts: ShiftJson[] }) => d.shifts);
  const found = shifts.find((s) => s.clockInAt === utc(from));
  if (!found) throw new Error(`shift at ${from} not listed`);
  return found;
}

function edit(
  cookie: string,
  id: string,
  body: { clockInAt?: string; clockOutAt?: string | null; reason?: string },
) {
  return call(editRecord, `/api/attendance/records/${id}`, {
    method: "PATCH",
    cookie,
    body,
    params: { id },
  });
}

function history(cookie: string, id: string) {
  return call(recordEdits, `/api/attendance/records/${id}/edits`, { cookie, params: { id } });
}

async function ownShifts(cookie: string): Promise<ShiftJson[]> {
  const listed = await call(records, "/api/attendance/records?month=2026-11", { cookie });
  return listed.json.days.flatMap((d: { shifts: ShiftJson[] }) => d.shifts);
}

describe("PATCH /api/attendance/records/:id", () => {
  it("lets an employee correct their own clock-in and records who changed what and why", async () => {
    const employee = await createAccount("employee");
    const record = await shift(employee.cookie, "2026-11-09T09:30:00", "2026-11-09T18:00:00");

    const result = await edit(employee.cookie, record.id, {
      clockInAt: "2026-11-09T09:00:00+09:00",
      clockOutAt: record.clockOutAt,
      reason: "  出勤の打刻漏れ  ",
    });

    expect(result.status).toBe(200);
    expect(result.json.shift).toEqual({
      id: record.id,
      clockInAt: utc("2026-11-09T09:00:00"),
      clockOutAt: utc("2026-11-09T18:00:00"),
      clockInSource: "edit",
      clockOutSource: "clock",
      editCount: 1,
      durationMs: 9 * 3_600_000,
    });
    expect(await ownShifts(employee.cookie)).toEqual([
      expect.objectContaining({
        id: record.id,
        clockInSource: "edit",
        clockOutSource: "clock",
        editCount: 1,
      }),
    ]);

    const edits = await history(employee.cookie, record.id);
    expect(edits.status).toBe(200);
    expect(edits.json.edits).toEqual([
      {
        id: expect.any(String),
        editor: { id: employee.user.id, displayName: employee.user.displayName },
        previousClockInAt: utc("2026-11-09T09:30:00"),
        previousClockOutAt: utc("2026-11-09T18:00:00"),
        newClockInAt: utc("2026-11-09T09:00:00"),
        newClockOutAt: utc("2026-11-09T18:00:00"),
        reason: "出勤の打刻漏れ",
        createdAt: utc("2026-11-10T12:00:00"),
      },
    ]);
  });

  it("lists clock button times as clock with no edits", async () => {
    const employee = await createAccount("employee");
    const record = await shift(employee.cookie, "2026-11-09T09:00:00", "2026-11-09T18:00:00");
    expect(record).toMatchObject({ clockInSource: "clock", clockOutSource: "clock", editCount: 0 });
  });

  it("closes a forgotten open record, which ends the working status", async () => {
    const employee = await createAccount("employee");
    const record = await shift(employee.cookie, "2026-11-10T09:00:00", null);

    const result = await edit(employee.cookie, record.id, {
      clockInAt: record.clockInAt,
      clockOutAt: "2026-11-10T11:30:00+09:00",
      reason: "退勤の打刻忘れ",
    });

    expect(result.status).toBe(200);
    expect(result.json.shift).toMatchObject({ clockInSource: "clock", clockOutSource: "edit" });
    expect(
      (await call(status, "/api/attendance/status", { cookie: employee.cookie })).json,
    ).toEqual({ status: { kind: "off_duty" } });
  });

  it("lists the newest edit first", async () => {
    const employee = await createAccount("employee");
    const record = await shift(employee.cookie, "2026-11-09T09:30:00", "2026-11-09T18:00:00");
    await edit(employee.cookie, record.id, {
      clockInAt: "2026-11-09T09:00:00+09:00",
      clockOutAt: record.clockOutAt,
      reason: "1回目",
    });
    vi.setSystemTime(jst("2026-11-10T12:05:00"));
    await edit(employee.cookie, record.id, {
      clockInAt: "2026-11-09T09:00:00+09:00",
      clockOutAt: "2026-11-09T18:30:00+09:00",
      reason: "2回目",
    });

    const edits = await history(employee.cookie, record.id);
    expect(edits.json.edits.map((e: { reason: string }) => e.reason)).toEqual(["2回目", "1回目"]);
    expect((await ownShifts(employee.cookie))[0]).toMatchObject({
      clockInSource: "edit",
      clockOutSource: "edit",
      editCount: 2,
    });
  });

  describe("authorization", () => {
    it("returns 401 without a session", async () => {
      const id = randomUUID();
      const result = await call(editRecord, `/api/attendance/records/${id}`, {
        method: "PATCH",
        body: {},
        params: { id },
      });
      expect(result.status).toBe(401);
    });

    it("hides another employee's record from an employee as not found", async () => {
      const owner = await createAccount("employee");
      const other = await createAccount("employee");
      const record = await shift(owner.cookie, "2026-11-09T09:30:00", "2026-11-09T18:00:00");

      const result = await edit(other.cookie, record.id, {
        clockInAt: "2026-11-09T09:00:00+09:00",
        clockOutAt: record.clockOutAt,
        reason: "勝手に修正",
      });
      const edits = await history(other.cookie, record.id);

      expect(result.status).toBe(404);
      expect(result.json.error.code).toBe("RECORD_NOT_FOUND");
      expect(edits.status).toBe(404);
      expect(edits.json.error.code).toBe("RECORD_NOT_FOUND");
      expect((await ownShifts(owner.cookie))[0]).toMatchObject({
        clockInSource: "clock",
        editCount: 0,
      });
    });

    it.each(["manager", "admin"] as const)(
      "lets a %s correct an employee's record and shows them as the editor",
      async (role) => {
        const editor = await createAccount(role);
        const employee = await createAccount("employee");
        const record = await shift(employee.cookie, "2026-11-09T09:30:00", "2026-11-09T18:00:00");

        const result = await edit(editor.cookie, record.id, {
          clockInAt: record.clockInAt,
          clockOutAt: "2026-11-09T18:45:00+09:00",
          reason: "打刻時刻の誤り",
        });
        expect(result.status).toBe(200);

        const edits = await history(employee.cookie, record.id);
        expect(edits.json.edits).toEqual([
          expect.objectContaining({
            editor: { id: editor.user.id, displayName: editor.user.displayName },
            reason: "打刻時刻の誤り",
          }),
        ]);
        const listed = await call(
          userRecords,
          `/api/manager/users/${employee.user.id}/records?month=2026-11`,
          { cookie: editor.cookie, params: { id: employee.user.id } },
        );
        expect(listed.json.days[0].shifts[0]).toMatchObject({
          clockInSource: "clock",
          clockOutSource: "edit",
          editCount: 1,
        });
      },
    );

    it.each([
      ["an unknown id", randomUUID()],
      ["a malformed id", "not-a-uuid"],
    ])("returns 404 for %s", async (_name, id) => {
      const { cookie } = await createAccount("manager");
      const result = await edit(cookie, id, {
        clockInAt: "2026-11-09T09:00:00+09:00",
        clockOutAt: null,
        reason: "理由",
      });
      expect(result.status).toBe(404);
      expect(result.json.error.code).toBe("RECORD_NOT_FOUND");
      expect((await history(cookie, id)).status).toBe(404);
    });
  });

  describe("rejections", () => {
    async function rejected(
      body: { clockInAt?: string; clockOutAt?: string | null; reason?: string },
      setup?: (cookie: string) => Promise<unknown>,
    ) {
      const employee = await createAccount("employee");
      await setup?.(employee.cookie);
      const record = await shift(employee.cookie, "2026-11-09T09:30:00", "2026-11-09T18:00:00");
      const result = await edit(employee.cookie, record.id, {
        clockInAt: record.clockInAt,
        clockOutAt: record.clockOutAt,
        reason: "修正",
        ...body,
      });
      const after = (await ownShifts(employee.cookie)).find((s) => s.id === record.id);
      expect(after).toEqual(record);
      expect((await history(employee.cookie, record.id)).json.edits).toEqual([]);
      return { status: result.status, code: result.json.error.code };
    }

    it("rejects overlapping another record", async () => {
      expect(
        await rejected({ clockInAt: "2026-11-09T07:00:00+09:00" }, (cookie) =>
          shift(cookie, "2026-11-09T06:00:00", "2026-11-09T08:00:00"),
        ),
      ).toEqual({ status: 409, code: "OVERLAPPING_RECORD" });
    });

    it("rejects a time in the future", async () => {
      expect(await rejected({ clockOutAt: "2026-11-10T12:01:00+09:00" })).toEqual({
        status: 400,
        code: "FUTURE_TIME",
      });
    });

    it("rejects a clock-out before the clock-in", async () => {
      expect(await rejected({ clockOutAt: "2026-11-09T09:00:00+09:00" })).toEqual({
        status: 409,
        code: "CLOCK_OUT_NOT_AFTER_CLOCK_IN",
      });
    });

    it("rejects clearing the clock-out", async () => {
      expect(await rejected({ clockInAt: "2026-11-09T09:00:00+09:00", clockOutAt: null })).toEqual({
        status: 409,
        code: "CLOCK_OUT_REQUIRED",
      });
    });

    it("rejects an edit that changes nothing", async () => {
      expect(await rejected({})).toEqual({ status: 409, code: "NO_CHANGES" });
    });

    it.each([
      ["missing", undefined],
      ["blank", "   "],
      ["longer than 200 characters", "あ".repeat(201)],
    ])("rejects a %s reason", async (_name, reason) => {
      expect(await rejected({ clockInAt: "2026-11-09T09:00:00+09:00", reason })).toEqual({
        status: 400,
        code: "VALIDATION_ERROR",
      });
    });

    it("rejects a time without an offset", async () => {
      expect(await rejected({ clockInAt: "2026-11-09T09:00" })).toEqual({
        status: 400,
        code: "VALIDATION_ERROR",
      });
    });
  });
});
