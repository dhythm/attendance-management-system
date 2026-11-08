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

export async function listUsersWithCreatedAt(db: Db): Promise<(User & { createdAt: Date })[]> {
  const rows = await db
    .select({ ...publicColumns, createdAt: users.createdAt })
    .from(users)
    .orderBy(asc(users.createdAt), asc(users.loginId));
  return rows.map((row) => ({ ...toUser(row), createdAt: row.createdAt }));
}

// Locking every admin row first makes concurrent demotions queue up, so the later one re-reads
// the admin set after the earlier commit and cannot leave the system without an admin.
export async function changeUserRole(
  db: Db,
  id: UserId,
  role: Role,
): Promise<User | "USER_NOT_FOUND" | "LAST_ADMIN"> {
  return db.transaction(async (tx) => {
    const admins = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .for("update");
    const [target] = await tx
      .select(publicColumns)
      .from(users)
      .where(eq(users.id, id))
      .for("update");
    if (!target) return "USER_NOT_FOUND";
    if (target.role === "admin" && role !== "admin" && admins.length <= 1) return "LAST_ADMIN";

    const [updated] = await tx
      .update(users)
      .set({ role })
      .where(eq(users.id, id))
      .returning(publicColumns);
    return toUser(updated);
  });
}
