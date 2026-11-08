import { type NextRequest, NextResponse } from "next/server";
import { withCapability } from "@/server/auth/current-user";
import { hashPassword } from "@/server/auth/password";
import { getDb } from "@/server/db/client";
import { errorResponse, parseJsonBody, withErrorHandling } from "@/server/http";
import { createUser, listUsersWithCreatedAt } from "@/server/repositories/users";
import { createUserRequestSchema, type ManagedUsersResponse } from "@/shared/api";

export const GET = withErrorHandling(
  withCapability("manageUsers", async () => {
    const users = await listUsersWithCreatedAt(await getDb());
    const body: ManagedUsersResponse = {
      users: users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() })),
    };
    return NextResponse.json(body);
  }),
);

export const POST = withErrorHandling(
  withCapability("manageUsers", async (request: NextRequest) => {
    const body = await parseJsonBody(request, createUserRequestSchema);
    if (!body.ok) return body.error;
    const { password, ...profile } = body.value;

    const user = await createUser(await getDb(), {
      ...profile,
      passwordHash: await hashPassword(password),
    });
    if (user === "LOGIN_ID_TAKEN") return errorResponse("LOGIN_ID_TAKEN");
    return NextResponse.json({ user }, { status: 201 });
  }),
);
