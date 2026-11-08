import { describe, expect, it, vi } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/me/route";
import { call, createAccount, sessionCookieFrom, uniqueLoginId } from "./helpers";

describe("POST /api/auth/login", () => {
  it("starts a session for correct credentials", async () => {
    const { loginId, password } = await createAccount();
    const result = await call(login, "/api/auth/login", { body: { loginId, password } });

    expect(result.status).toBe(200);
    expect(result.json.user).toMatchObject({ loginId, role: "employee" });
    expect(result.json.user).not.toHaveProperty("passwordHash");
    const setCookie = result.response.headers.getSetCookie().join("\n");
    expect(setCookie).toMatch(/session=[^;]+;/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);

    const current = await call(me, "/api/me", { cookie: sessionCookieFrom(result.response) });
    expect(current.status).toBe(200);
    expect(current.json.user.loginId).toBe(loginId);
  });

  it("rejects an empty payload with 400", async () => {
    const result = await call(login, "/api/auth/login", { body: { loginId: "", password: "" } });
    expect(result.status).toBe(400);
    expect(result.json.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a body that is not JSON with 400", async () => {
    const result = await call(login, "/api/auth/login", { rawBody: "{not json" });
    expect(result.status).toBe(400);
    expect(result.json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns the same 401 for a wrong password and an unknown login ID", async () => {
    const { loginId } = await createAccount();
    const wrongPassword = await call(login, "/api/auth/login", {
      body: { loginId, password: "wrong-password" },
    });
    const unknownUser = await call(login, "/api/auth/login", {
      body: { loginId: uniqueLoginId("nobody"), password: "wrong-password" },
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.json).toEqual(unknownUser.json);
    expect(wrongPassword.json.error.code).toBe("INVALID_CREDENTIALS");
    expect(sessionCookieFrom(wrongPassword.response)).toBeNull();
  });
});

describe("GET /api/me", () => {
  it("returns 401 without a session", async () => {
    const result = await call(me, "/api/me");
    expect(result.status).toBe(401);
    expect(result.json.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 once the session has expired after 7 days", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
      const { cookie } = await createAccount();
      vi.setSystemTime(new Date("2026-11-07T23:59:59Z"));
      expect((await call(me, "/api/me", { cookie })).status).toBe(200);
      vi.setSystemTime(new Date("2026-11-08T00:00:01Z"));
      expect((await call(me, "/api/me", { cookie })).status).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns 401 for an unknown session token", async () => {
    const result = await call(me, "/api/me", { cookie: "session=forged-token" });
    expect(result.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("ends the session so the same cookie no longer authenticates", async () => {
    const { cookie } = await createAccount();
    const result = await call(logout, "/api/auth/logout", { method: "POST", cookie });

    expect(result.status).toBe(204);
    expect(result.response.headers.getSetCookie().join("\n")).toMatch(/session=;/);
    const current = await call(me, "/api/me", { cookie });
    expect(current.status).toBe(401);
  });

  it("succeeds without a session", async () => {
    const result = await call(logout, "/api/auth/logout", { method: "POST" });
    expect(result.status).toBe(204);
  });
});
