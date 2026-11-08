import type { NextRequest } from "next/server";
import { type Capability, can } from "@/domain/role";
import type { User } from "@/domain/user";
import { getDb } from "@/server/db/client";
import { errorResponse } from "@/server/http";
import { findUserBySessionToken } from "@/server/repositories/sessions";
import { readSessionToken } from "./cookie";

export async function findCurrentUser(token: string | null): Promise<User | null> {
  if (!token) return null;
  return findUserBySessionToken(await getDb(), token, new Date());
}

type Handler<C> = (request: NextRequest, user: User, ctx: C) => Promise<Response>;

export function withUser<C>(
  handler: Handler<C>,
): (request: NextRequest, ctx: C) => Promise<Response> {
  return async (request, ctx) => {
    const user = await findCurrentUser(readSessionToken(request));
    if (!user) return errorResponse("UNAUTHORIZED");
    return handler(request, user, ctx);
  };
}

export function withCapability<C>(
  capability: Capability,
  handler: Handler<C>,
): (request: NextRequest, ctx: C) => Promise<Response> {
  return withUser<C>((request, user, ctx) =>
    can(user.role, capability)
      ? handler(request, user, ctx)
      : Promise.resolve(errorResponse("FORBIDDEN")),
  );
}
