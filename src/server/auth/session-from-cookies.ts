import { cookies } from "next/headers";
import type { User } from "@/domain/user";
import { SESSION_COOKIE } from "./cookie";
import { findCurrentUser } from "./current-user";

export async function currentUserFromCookies(): Promise<User | null> {
  const store = await cookies();
  return findCurrentUser(store.get(SESSION_COOKIE)?.value ?? null);
}
