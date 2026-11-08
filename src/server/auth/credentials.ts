import type { User } from "@/domain/user";
import type { Db } from "@/server/db/client";
import { findUserWithPasswordHash } from "@/server/repositories/users";
import { hashPassword, verifyPassword } from "./password";

let dummyHash: Promise<string> | undefined;

export async function verifyCredentials(
  db: Db,
  loginId: string,
  password: string,
): Promise<User | null> {
  const found = await findUserWithPasswordHash(db, loginId);
  if (!found) {
    // Spend the same scrypt work so response time does not reveal whether the login ID exists.
    dummyHash ??= hashPassword("dummy-password-for-timing");
    await verifyPassword(password, await dummyHash);
    return null;
  }
  return (await verifyPassword(password, found.passwordHash)) ? found.user : null;
}
