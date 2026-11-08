import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as clockIn } from "@/app/api/attendance/clock-in/route";
import { POST as clockOut } from "@/app/api/attendance/clock-out/route";
import { GET as records } from "@/app/api/attendance/records/route";
import { GET as status } from "@/app/api/attendance/status/route";
import { call, createAccount } from "./helpers";

const jst = (iso: string) => new Date(`${iso}+09:00`);
const HOUR = 3_600_000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(jst("2026-11-02T09:00:00"));
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

describe("authorization", () => {
  it.each([
    ["status", status, "/api/attendance/status", "GET"],
    ["clock-in", clockIn, "/api/attendance/clock-in", "POST"],
    ["clock-out", clockOut, "/api/attendance/clock-out", "POST"],
    ["records", records, "/api/attendance/records", "GET"],
  ] as const)("%s returns 401 without a session", async (_name, handler, path, method) => {
    const result = await call(handler, path, { method });
    expect(result.status).toBe(401);
    expect(result.json.error.code).toBe("UNAUTHORIZED");
  });
});

describe("clocking in and out", () => {
  it("starts off duty", async () => {
    const { cookie } = await createAccount();
    const result = await call(status, "/api/attendance/status", { cookie });
    expect(result.status).toBe(200);
    expect(result.json).toEqual({ status: { kind: "off_duty" } });
  });

  it("clocks in and reports working since the clock-in time", async () => {
    const { cookie } = await createAccount();
    const result = await call(clockIn, "/api/attendance/clock-in", { method: "POST", cookie });

    const working = { status: { kind: "working", since: "2026-11-02T00:00:00.000Z" } };
    expect(result.status).toBe(201);
    expect(result.json).toEqual(working);
    expect((await call(status, "/api/attendance/status", { cookie })).json).toEqual(working);
  });

  it("rejects a second clock-in with 409", async () => {
    const { cookie } = await createAccount();
    await call(clockIn, "/api/attendance/clock-in", { method: "POST", cookie });
    const second = await call(clockIn, "/api/attendance/clock-in", { method: "POST", cookie });
    expect(second.status).toBe(409);
    expect(second.json.error.code).toBe("ALREADY_WORKING");
  });

  it("accepts only one of two concurrent clock-ins", async () => {
    const { cookie } = await createAccount();
    const results = await Promise.all([
      call(clockIn, "/api/attendance/clock-in", { method: "POST", cookie }),
      call(clockIn, "/api/attendance/clock-in", { method: "POST", cookie }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it("clocks out and returns to off duty", async () => {
    const { cookie } = await createAccount();
    await call(clockIn, "/api/attendance/clock-in", { method: "POST", cookie });
    vi.setSystemTime(jst("2026-11-02T18:00:00"));
    const result = await call(clockOut, "/api/attendance/clock-out", { method: "POST", cookie });

    expect(result.status).toBe(200);
    expect(result.json).toEqual({ status: { kind: "off_duty" } });
    expect((await call(status, "/api/attendance/status", { cookie })).json).toEqual({
      status: { kind: "off_duty" },
    });
  });

  it("rejects clock-out when not working with 409", async () => {
    const { cookie } = await createAccount();
    const result = await call(clockOut, "/api/attendance/clock-out", { method: "POST", cookie });
    expect(result.status).toBe(409);
    expect(result.json.error.code).toBe("NOT_WORKING");
  });

  it("keeps each user's attendance separate", async () => {
    const alice = await createAccount();
    const bob = await createAccount();
    await call(clockIn, "/api/attendance/clock-in", { method: "POST", cookie: alice.cookie });
    const bobStatus = await call(status, "/api/attendance/status", { cookie: bob.cookie });
    expect(bobStatus.json).toEqual({ status: { kind: "off_duty" } });
  });
});

describe("GET /api/attendance/records", () => {
  it("lists the month's shifts by clock-in date in Asia/Tokyo with durations and a total", async () => {
    vi.setSystemTime(jst("2026-10-31T21:00:00"));
    const { cookie } = await createAccount();
    await shift(cookie, "2026-10-31T22:00:00", "2026-11-01T05:00:00");
    await shift(cookie, "2026-11-02T09:00:00", "2026-11-02T18:00:00");
    await shift(cookie, "2026-11-04T09:00:00", "2026-11-04T12:00:00");
    await shift(cookie, "2026-11-04T13:00:00", "2026-11-04T18:00:00");
    await shift(cookie, "2026-11-06T22:00:00", "2026-11-07T06:30:00");

    const result = await call(records, "/api/attendance/records?month=2026-11", { cookie });

    expect(result.status).toBe(200);
    expect(result.json.month).toBe("2026-11");
    expect(
      result.json.days.map((d: { workDate: string; shifts: unknown[]; durationMs: number }) => [
        d.workDate,
        d.shifts.length,
        d.durationMs,
      ]),
    ).toEqual([
      ["2026-11-02", 1, 9 * HOUR],
      ["2026-11-04", 2, 8 * HOUR],
      ["2026-11-06", 1, 8.5 * HOUR],
    ]);
    expect(result.json.totalMs).toBe(25.5 * HOUR);
  });

  it("includes an open shift without a duration", async () => {
    const { cookie } = await createAccount();
    await call(clockIn, "/api/attendance/clock-in", { method: "POST", cookie });
    const result = await call(records, "/api/attendance/records?month=2026-11", { cookie });
    expect(result.json.days).toEqual([
      {
        workDate: "2026-11-02",
        durationMs: 0,
        working: true,
        shifts: [
          {
            id: expect.any(String),
            clockInAt: "2026-11-02T00:00:00.000Z",
            clockOutAt: null,
            clockInSource: "clock",
            clockOutSource: null,
            editCount: 0,
            durationMs: null,
          },
        ],
      },
    ]);
    expect(result.json.totalMs).toBe(0);
  });

  it("defaults to the current month in Asia/Tokyo", async () => {
    vi.setSystemTime(new Date("2026-11-30T15:30:00Z"));
    const { cookie } = await createAccount();
    const result = await call(records, "/api/attendance/records", { cookie });
    expect(result.json.month).toBe("2026-12");
  });

  it("does not include other users' shifts", async () => {
    const alice = await createAccount();
    const bob = await createAccount();
    await shift(alice.cookie, "2026-11-02T09:00:00", "2026-11-02T18:00:00");
    const result = await call(records, "/api/attendance/records?month=2026-11", {
      cookie: bob.cookie,
    });
    expect(result.json.days).toEqual([]);
  });

  it("rejects an invalid month with 400", async () => {
    const { cookie } = await createAccount();
    const result = await call(records, "/api/attendance/records?month=2026-13", { cookie });
    expect(result.status).toBe(400);
    expect(result.json.error.code).toBe("VALIDATION_ERROR");
  });
});
