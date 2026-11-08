import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { type Role, roles } from "@/domain/role";
import type { User, UserId } from "@/domain/user";
import type { Db } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/errors";
import { users } from "@/server/db/schema";

const userIdSchema = z.uuid().transform((id) => id as UserId);

const userRow = z.object({
  id: userIdSchema,
  loginId: z.string(),
  displayName: z.string(),
  role: z.enum(roles),
});

export function parseUserId(raw: string): UserId | null {
  const parsed = userIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function toUser(row: unknown): User {
  return userRow.parse(row);
}

export async function createUser(
  db: Db,
  input: { loginId: string; displayName: string; passwordHash: string; role: Role },
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

const publicColumns = {
  id: users.id,
  loginId: users.loginId,
  displayName: users.displayName,
  role: users.role,
};

export async function listUsers(db: Db): Promise<User[]> {
  const rows = await db.select(publicColumns).from(users).orderBy(asc(users.loginId));
  return rows.map(toUser);
}

export async function findUserById(db: Db, id: UserId): Promise<User | null> {
  const [row] = await db.select(publicColumns).from(users).where(eq(users.id, id)).limit(1);
  return row ? toUser(row) : null;
}
