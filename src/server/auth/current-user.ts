import type { NextRequest } from "next/server";
import type { User } from "@/domain/user";
import { getDb } from "@/server/db/client";
import { errorResponse } from "@/server/http";
import { findUserBySessionToken } from "@/server/repositories/sessions";
import { readSessionToken } from "./cookie";

export async function findCurrentUser(token: string | null): Promise<User | null> {
  if (!token) return null;
  return findUserBySessionToken(await getDb(), token, new Date());
}

export function withUser(
  handler: (request: NextRequest, user: User) => Promise<Response>,
): (request: NextRequest) => Promise<Response> {
  return async (request) => {
    const user = await findCurrentUser(readSessionToken(request));
    if (!user) return errorResponse("UNAUTHORIZED");
    return handler(request, user);
  };
}
