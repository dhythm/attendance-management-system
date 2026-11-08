import { and, eq, gt } from "drizzle-orm";
import type { User, UserId } from "@/domain/user";
import { generateSessionToken, hashSessionToken } from "@/server/auth/session-token";
import type { Db } from "@/server/db/client";
import { sessions, users } from "@/server/db/schema";
import { toUser } from "./users";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createSession(
  db: Db,
  userId: UserId,
  now: Date,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(sessions).values({ userId, tokenHash: hashSessionToken(token), expiresAt });
  return { token, expiresAt };
}

export async function findUserBySessionToken(
  db: Db,
  token: string,
  now: Date,
): Promise<User | null> {
  const [row] = await db
    .select({
      id: users.id,
      loginId: users.loginId,
      displayName: users.displayName,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashSessionToken(token)), gt(sessions.expiresAt, now)))
    .limit(1);
  return row ? toUser(row) : null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
}
