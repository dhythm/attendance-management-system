import { eq } from "drizzle-orm";
import { z } from "zod";
import type { User, UserId } from "@/domain/user";
import type { Db } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/errors";
import { users } from "@/server/db/schema";

const userRow = z.object({
  id: z.uuid().transform((id) => id as UserId),
  loginId: z.string(),
  displayName: z.string(),
});

export function toUser(row: unknown): User {
  return userRow.parse(row);
}

export async function createUser(
  db: Db,
  input: { loginId: string; displayName: string; passwordHash: string },
): Promise<User | "LOGIN_ID_TAKEN"> {
  try {
    const [row] = await db.insert(users).values(input).returning();
    return toUser(row);
  } catch (error) {
    if (isUniqueViolation(error)) return "LOGIN_ID_TAKEN";
    throw error;
  }
}

export async function findUserWithPasswordHash(
  db: Db,
  loginId: string,
): Promise<{ user: User; passwordHash: string } | null> {
  const [row] = await db.select().from(users).where(eq(users.loginId, loginId)).limit(1);
  return row ? { user: toUser(row), passwordHash: row.passwordHash } : null;
}
