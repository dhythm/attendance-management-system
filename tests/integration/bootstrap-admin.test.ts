import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { GET as me } from "@/app/api/me/route";
import { ensureAdmin } from "@/server/bootstrap-admin";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { call, createAccount, logIn, uniqueLoginId } from "./helpers";

describe("ensureAdmin", () => {
  it("creates an admin who can log in", async () => {
    const loginId = uniqueLoginId("boot");
    const result = await ensureAdmin(await getDb(), {
      loginId,
      displayName: "初期管理者",
      password: "bootstrap-password",
    });

    expect(result).toBe("CREATED");
    const current = await call(me, "/api/me", {
      cookie: await logIn(loginId, "bootstrap-password"),
    });
    expect(current.json.user).toMatchObject({ loginId, role: "admin" });
  });

  it("leaves an existing admin and their password untouched when run again", async () => {
    const db = await getDb();
    const loginId = uniqueLoginId("boot");
    await ensureAdmin(db, { loginId, displayName: "初期管理者", password: "first-password" });
    const second = await ensureAdmin(db, {
      loginId,
      displayName: "別名",
      password: "second-password",
    });

    expect(second).toBe("ALREADY_ADMIN");
    expect(await db.select().from(users).where(eq(users.loginId, loginId))).toHaveLength(1);
    await logIn(loginId, "first-password");
  });

  it("refuses to promote an existing non-admin account", async () => {
    const { loginId, cookie } = await createAccount("employee");
    const result = await ensureAdmin(await getDb(), {
      loginId,
      displayName: "乗っ取り",
      password: "bootstrap-password",
    });

    expect(result).toBe("LOGIN_ID_TAKEN");
    expect((await call(me, "/api/me", { cookie })).json.user.role).toBe("employee");
  });
});
