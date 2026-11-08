import { eq } from "drizzle-orm";
import { hashPassword } from "@/server/auth/password";
import type { Db } from "@/server/db/client";
import { users } from "@/server/db/schema";

export async function ensureAdmin(
  db: Db,
  input: { loginId: string; displayName: string; password: string },
): Promise<"CREATED" | "ALREADY_ADMIN" | "LOGIN_ID_TAKEN"> {
  const passwordHash = await hashPassword(input.password);
  const inserted = await db
    .insert(users)
    .values({ loginId: input.loginId, displayName: input.displayName, passwordHash, role: "admin" })
    .onConflictDoNothing({ target: users.loginId })
    .returning({ id: users.id });
  if (inserted.length > 0) return "CREATED";

  const [existing] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.loginId, input.loginId));
  return existing?.role === "admin" ? "ALREADY_ADMIN" : "LOGIN_ID_TAKEN";
}
