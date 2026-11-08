import type { NextRequest } from "next/server";
import type { User } from "@/domain/user";
import { getDb } from "@/server/db/client";
import { findUserBySessionToken } from "@/server/repositories/sessions";
import { readSessionToken } from "./cookie";

export async function findCurrentUser(token: string | null): Promise<User | null> {
  if (!token) return null;
  return findUserBySessionToken(await getDb(), token, new Date());
}

export function authenticate(request: NextRequest): Promise<User | null> {
  return findCurrentUser(readSessionToken(request));
}
