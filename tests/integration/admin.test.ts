import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PATCH as changeRole } from "@/app/api/admin/users/[id]/route";
import { POST as createUser, GET as listUsers } from "@/app/api/admin/users/route";
import { GET as usersOverview } from "@/app/api/manager/users/route";
import { GET as me } from "@/app/api/me/route";
import { call, createAccount, logIn, uniqueLoginId } from "./helpers";

function newUser(overrides: Record<string, unknown> = {}) {
  return {
    loginId: uniqueLoginId("new"),
    displayName: "新入 社員",
    password: "new-user-password",
    role: "employee",
    ...overrides,
  };
}

describe("admin API authorization", () => {
  it.each(["employee", "manager"] as const)("returns 403 to a %s", async (role) => {
    const { cookie } = await createAccount(role);
    const target = await createAccount("employee");

    const results = [
      await call(listUsers, "/api/admin/users", { cookie }),
      await call(createUser, "/api/admin/users", { cookie, body: newUser() }),
      await call(changeRole, `/api/admin/users/${target.user.id}`, {
        method: "PATCH",
        cookie,
        body: { role: "admin" },
        params: { id: target.user.id },
      }),
    ];

    expect(results.map((r) => [r.status, r.json.error.code])).toEqual([
      [403, "FORBIDDEN"],
      [403, "FORBIDDEN"],
      [403, "FORBIDDEN"],
    ]);
    expect((await call(me, "/api/me", { cookie: target.cookie })).json.user.role).toBe("employee");
  });

  it("returns 401 without a session", async () => {
    expect((await call(listUsers, "/api/admin/users")).status).toBe(401);
  });
});

describe("POST /api/admin/users", () => {
  it("creates a user who can then log in with the given role, without logging the admin out", async () => {
    const admin = await createAccount("admin");
    const body = newUser({ role: "manager" });

    const result = await call(createUser, "/api/admin/users", { cookie: admin.cookie, body });

    expect(result.status).toBe(201);
    expect(result.json.user).toMatchObject({
      loginId: body.loginId,
      displayName: "新入 社員",
      role: "manager",
    });
    expect(result.json.user).not.toHaveProperty("passwordHash");
    expect(result.response.headers.getSetCookie()).toEqual([]);
    const current = await call(me, "/api/me", { cookie: await logIn(body.loginId, body.password) });
    expect(current.json.user).toMatchObject({ loginId: body.loginId, role: "manager" });
  });

  it("rejects a login ID that is already taken with 409", async () => {
    const admin = await createAccount("admin");
    const existing = await createAccount("employee");
    const result = await call(createUser, "/api/admin/users", {
      cookie: admin.cookie,
      body: newUser({ loginId: existing.loginId }),
    });
    expect(result.status).toBe(409);
    expect(result.json.error.code).toBe("LOGIN_ID_TAKEN");
  });

  it.each([
    ["a short password", { password: "short" }],
    ["an unknown role", { role: "owner" }],
    ["an invalid login ID", { loginId: "a" }],
    ["an empty display name", { displayName: " " }],
  ])("rejects %s with 400", async (_name, overrides) => {
    const admin = await createAccount("admin");
    const result = await call(createUser, "/api/admin/users", {
      cookie: admin.cookie,
      body: newUser(overrides),
    });
    expect(result.status).toBe(400);
    expect(result.json.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/admin/users", () => {
  it("lists users with login ID, name, role and creation time", async () => {
    const admin = await createAccount("admin");
    const employee = await createAccount("employee");
    const result = await call(listUsers, "/api/admin/users", { cookie: admin.cookie });

    expect(result.status).toBe(200);
    const row = result.json.users.find((u: { id: string }) => u.id === employee.user.id);
    expect(row).toEqual({
      id: employee.user.id,
      loginId: employee.loginId,
      displayName: employee.user.displayName,
      role: "employee",
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });
});

describe("PATCH /api/admin/users/:id", () => {
  it("changes the role, effective on the user's next request", async () => {
    const admin = await createAccount("admin");
    const employee = await createAccount("employee");
    expect(
      (await call(usersOverview, "/api/manager/users", { cookie: employee.cookie })).status,
    ).toBe(403);

    const result = await call(changeRole, `/api/admin/users/${employee.user.id}`, {
      method: "PATCH",
      cookie: admin.cookie,
      body: { role: "manager" },
      params: { id: employee.user.id },
    });

    expect(result.status).toBe(200);
    expect(result.json.user).toMatchObject({ id: employee.user.id, role: "manager" });
    expect(
      (await call(usersOverview, "/api/manager/users", { cookie: employee.cookie })).status,
    ).toBe(200);
  });

  it.each([
    ["an unknown user", randomUUID()],
    ["a malformed id", "not-a-uuid"],
  ])("returns 404 for %s", async (_name, id) => {
    const admin = await createAccount("admin");
    const result = await call(changeRole, `/api/admin/users/${id}`, {
      method: "PATCH",
      cookie: admin.cookie,
      body: { role: "manager" },
      params: { id },
    });
    expect(result.status).toBe(404);
    expect(result.json.error.code).toBe("USER_NOT_FOUND");
  });

  it("rejects an unknown role with 400", async () => {
    const admin = await createAccount("admin");
    const employee = await createAccount("employee");
    const result = await call(changeRole, `/api/admin/users/${employee.user.id}`, {
      method: "PATCH",
      cookie: admin.cookie,
      body: { role: "owner" },
      params: { id: employee.user.id },
    });
    expect(result.status).toBe(400);
  });
});
