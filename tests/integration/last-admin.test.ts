import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PATCH as changeRole } from "@/app/api/admin/users/[id]/route";
import { GET as listUsers } from "@/app/api/admin/users/route";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { changeUserRole } from "@/server/repositories/users";
import { call, createAccount, useFreshDatabase } from "./helpers";

// The last-admin rule counts every admin in the database, so each test starts from an empty one.
let dropDatabase: () => Promise<void>;
beforeEach(async () => {
  dropDatabase = await useFreshDatabase();
});
afterEach(() => dropDatabase());

function demote(cookie: string, id: string) {
  return call(changeRole, `/api/admin/users/${id}`, {
    method: "PATCH",
    cookie,
    body: { role: "employee" },
    params: { id },
  });
}

async function adminIds(cookie: string): Promise<string[]> {
  const result = await call(listUsers, "/api/admin/users", { cookie });
  return result.json.users
    .filter((u: { role: string }) => u.role === "admin")
    .map((u: { id: string }) => u.id);
}

describe("the last admin", () => {
  it("cannot be demoted", async () => {
    const only = await createAccount("admin");

    const result = await demote(only.cookie, only.user.id);

    expect(result.status).toBe(409);
    expect(result.json.error.code).toBe("LAST_ADMIN");
    expect(await adminIds(only.cookie)).toEqual([only.user.id]);
  });

  it("can be demoted while another admin remains", async () => {
    const a = await createAccount("admin");
    const b = await createAccount("admin");

    expect((await demote(a.cookie, b.user.id)).status).toBe(200);
    expect(await adminIds(a.cookie)).toEqual([a.user.id]);
  });

  it("survives two admins demoting each other at once", async () => {
    const a = await createAccount("admin");
    const b = await createAccount("admin");

    const results = await Promise.all([demote(a.cookie, b.user.id), demote(b.cookie, a.user.id)]);

    // The loser is 409 when both requests pass authorization before either commits, and 403 when
    // the winner commits first and the loser is no longer an admin.
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409 || s === 403)).toHaveLength(1);
    const survivor = results[0]?.status === 200 ? a : b;
    expect(await adminIds(survivor.cookie)).toEqual([survivor.user.id]);
  });

  it("makes a concurrent demotion wait for an uncommitted one and then refuse", async () => {
    const a = await createAccount("admin");
    const b = await createAccount("admin");
    const db = await getDb();

    let concurrent: Promise<unknown> | undefined;
    await db.transaction(async (tx) => {
      expect(await changeUserRole(tx, a.user.id, "employee")).toMatchObject({ role: "employee" });
      concurrent = changeUserRole(db, b.user.id, "employee");
      // Give the second change time to reach the admin rows while this demotion is uncommitted.
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    expect(await concurrent).toBe("LAST_ADMIN");
    expect(await db.select().from(users).where(eq(users.role, "admin"))).toHaveLength(1);
  });
});
