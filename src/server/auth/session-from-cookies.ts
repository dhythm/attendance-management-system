import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type Capability, can } from "@/domain/role";
import type { User } from "@/domain/user";
import { SESSION_COOKIE } from "./cookie";
import { findCurrentUser } from "./current-user";

export async function currentUserFromCookies(): Promise<User | null> {
  const store = await cookies();
  return findCurrentUser(store.get(SESSION_COOKIE)?.value ?? null);
}

export async function requirePageCapability(capability: Capability): Promise<User> {
  const user = await currentUserFromCookies();
  if (!user) redirect("/login");
  if (!can(user.role, capability)) redirect("/");
  return user;
}
