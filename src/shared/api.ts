import { z } from "zod";
import { timeSources } from "@/domain/attendance";
import { roles } from "@/domain/role";

export const loginIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.-]{3,32}$/, "ログインIDは半角英数字と _ . - で3〜32文字にしてください");

export const passwordSchema = z
  .string()
  .min(8, "パスワードは8文字以上にしてください")
  .max(128, "パスワードは128文字以内にしてください");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "表示名を入力してください")
  .max(50, "表示名は50文字以内にしてください");

export const loginRequestSchema = z.object({
  loginId: z.string().trim().min(1, "ログインIDを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const errorCodes = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "USER_NOT_FOUND",
  "INVALID_CREDENTIALS",
  "LOGIN_ID_TAKEN",
  "LAST_ADMIN",
  "ALREADY_WORKING",
  "NOT_WORKING",
  "CLOCK_OUT_NOT_AFTER_CLOCK_IN",
  "RECORD_NOT_FOUND",
  "NO_CHANGES",
  "CLOCK_OUT_REQUIRED",
  "FUTURE_TIME",
  "OVERLAPPING_RECORD",
  "INTERNAL_ERROR",
] as const;
export type ErrorCode = (typeof errorCodes)[number];

export const errorBodySchema = z.object({
  error: z.object({ code: z.enum(errorCodes), message: z.string() }),
});

const isoDateTime = z.iso.datetime();

export const userSchema = z.object({
  id: z.uuid(),
  loginId: z.string(),
  displayName: z.string(),
  role: z.enum(roles),
});
export type User = z.infer<typeof userSchema>;

export const userResponseSchema = z.object({ user: userSchema });

export const statusSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("off_duty") }),
  z.object({ kind: z.literal("working"), since: isoDateTime }),
]);
export const statusResponseSchema = z.object({ status: statusSchema });
export type StatusResponse = z.infer<typeof statusResponseSchema>;

const timeSourceSchema = z.enum(timeSources);

export const shiftSchema = z.object({
  id: z.uuid(),
  clockInAt: isoDateTime,
  clockOutAt: isoDateTime.nullable(),
  clockInSource: timeSourceSchema,
  clockOutSource: timeSourceSchema.nullable(),
  editCount: z.number().int().nonnegative(),
  durationMs: z.number().nullable(),
});
export type ShiftResponse = z.infer<typeof shiftSchema>;

export const recordsResponseSchema = z.object({
  month: z.string(),
  days: z.array(
    z.object({
      workDate: z.string(),
      durationMs: z.number(),
      working: z.boolean(),
      shifts: z.array(shiftSchema),
    }),
  ),
  totalMs: z.number(),
});
export type RecordsResponse = z.infer<typeof recordsResponseSchema>;

const offsetDateTime = z.iso.datetime({
  offset: true,
  error: "日時はタイムゾーン付きのISO 8601形式で指定してください",
});

export const editRecordRequestSchema = z.object({
  clockInAt: offsetDateTime,
  clockOutAt: offsetDateTime.nullable(),
  reason: z
    .string("修正理由を入力してください")
    .trim()
    .min(1, "修正理由を入力してください")
    .max(200, "修正理由は200文字以内にしてください"),
});
export type EditRecordRequest = z.infer<typeof editRecordRequestSchema>;

export const editRecordResponseSchema = z.object({ shift: shiftSchema });

export const recordEditsResponseSchema = z.object({
  edits: z.array(
    z.object({
      id: z.uuid(),
      editor: z.object({ id: z.uuid(), displayName: z.string() }),
      previousClockInAt: isoDateTime,
      previousClockOutAt: isoDateTime.nullable(),
      newClockInAt: isoDateTime,
      newClockOutAt: isoDateTime.nullable(),
      reason: z.string(),
      createdAt: isoDateTime,
    }),
  ),
});
export type RecordEditsResponse = z.infer<typeof recordEditsResponseSchema>;

export const usersOverviewResponseSchema = z.object({
  month: z.string(),
  users: z.array(userSchema.extend({ status: statusSchema, totalMs: z.number() })),
});
export type UsersOverviewResponse = z.infer<typeof usersOverviewResponseSchema>;

const roleSchema = z.enum(roles, "権限を選択してください");

export const createUserRequestSchema = z.object({
  loginId: loginIdSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
  role: roleSchema,
});
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

export const changeRoleRequestSchema = z.object({ role: roleSchema });

export const managedUsersResponseSchema = z.object({
  users: z.array(userSchema.extend({ createdAt: isoDateTime })),
});
export type ManagedUsersResponse = z.infer<typeof managedUsersResponseSchema>;
