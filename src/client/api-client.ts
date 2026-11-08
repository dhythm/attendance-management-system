import type { z } from "zod";
import type { Role } from "@/domain/role";
import {
  type CreateUserRequest,
  type EditRecordRequest,
  type ErrorCode,
  editRecordResponseSchema,
  errorBodySchema,
  type LoginRequest,
  managedUsersResponseSchema,
  recordEditsResponseSchema,
  recordsResponseSchema,
  statusResponseSchema,
  userResponseSchema,
  usersOverviewResponseSchema,
} from "@/shared/api";

export type ApiError = Error & { code: ErrorCode | "NETWORK_ERROR"; status: number };

function apiError(code: ApiError["code"], message: string, status: number): ApiError {
  return Object.assign(new Error(message), { name: "ApiError", code, status });
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && error.name === "ApiError";
}

async function request<S extends z.ZodType>(
  path: string,
  schema: S | null,
  init: { method?: string; body?: unknown } = {},
): Promise<z.infer<S>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
    });
  } catch {
    throw apiError("NETWORK_ERROR", "サーバーに接続できませんでした", 0);
  }

  const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = errorBodySchema.safeParse(payload);
    if (parsed.success) {
      throw apiError(parsed.data.error.code, parsed.data.error.message, response.status);
    }
    throw apiError("INTERNAL_ERROR", "予期しないエラーが発生しました", response.status);
  }
  return schema ? schema.parse(payload) : (undefined as z.infer<S>);
}

export const api = {
  login: (body: LoginRequest) =>
    request("/api/auth/login", userResponseSchema, { method: "POST", body }),
  logout: () => request("/api/auth/logout", null, { method: "POST" }),
  status: () => request("/api/attendance/status", statusResponseSchema),
  clockIn: () => request("/api/attendance/clock-in", statusResponseSchema, { method: "POST" }),
  clockOut: () => request("/api/attendance/clock-out", statusResponseSchema, { method: "POST" }),
  records: (month: string) =>
    request(`/api/attendance/records?month=${encodeURIComponent(month)}`, recordsResponseSchema),
  editRecord: (recordId: string, body: EditRecordRequest) =>
    request(`/api/attendance/records/${encodeURIComponent(recordId)}`, editRecordResponseSchema, {
      method: "PATCH",
      body,
    }),
  recordEdits: (recordId: string) =>
    request(
      `/api/attendance/records/${encodeURIComponent(recordId)}/edits`,
      recordEditsResponseSchema,
    ),
  usersOverview: (month: string) =>
    request(`/api/manager/users?month=${encodeURIComponent(month)}`, usersOverviewResponseSchema),
  userRecords: (userId: string, month: string) =>
    request(
      `/api/manager/users/${encodeURIComponent(userId)}/records?month=${encodeURIComponent(month)}`,
      recordsResponseSchema,
    ),
  managedUsers: () => request("/api/admin/users", managedUsersResponseSchema),
  createUser: (body: CreateUserRequest) =>
    request("/api/admin/users", userResponseSchema, { method: "POST", body }),
  changeRole: (userId: string, role: Role) =>
    request(`/api/admin/users/${encodeURIComponent(userId)}`, userResponseSchema, {
      method: "PATCH",
      body: { role },
    }),
};
