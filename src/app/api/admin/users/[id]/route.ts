import { NextResponse } from "next/server";
import { withCapability } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { errorResponse, parseJsonBody, withErrorHandling } from "@/server/http";
import { changeUserRole, parseUserId } from "@/server/repositories/users";
import { changeRoleRequestSchema } from "@/shared/api";

export const PATCH = withErrorHandling(
  withCapability<RouteContext<"/api/admin/users/[id]">>(
    "manageUsers",
    async (request, _user, ctx) => {
      const userId = parseUserId((await ctx.params).id);
      if (!userId) return errorResponse("USER_NOT_FOUND");
      const body = await parseJsonBody(request, changeRoleRequestSchema);
      if (!body.ok) return body.error;

      const user = await changeUserRole(await getDb(), userId, body.value.role);
      if (typeof user === "string") return errorResponse(user);
      return NextResponse.json({ user });
    },
  ),
);
