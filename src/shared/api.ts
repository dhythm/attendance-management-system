import { z } from "zod";

export const loginIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.-]{3,32}$/, "ログインIDは半角英数字と _ . - で3〜32文字にしてください");

export const passwordSchema = z
  .string()
  .min(8, "パスワードは8文字以上にしてください")
  .max(128, "パスワードは128文字以内にしてください");

export const signupRequestSchema = z.object({
  loginId: loginIdSchema,
  password: passwordSchema,
  displayName: z
    .string()
    .trim()
    .min(1, "表示名を入力してください")
    .max(50, "表示名は50文字以内にしてください"),
});
export type SignupRequest = z.infer<typeof signupRequestSchema>;

export const loginRequestSchema = z.object({
  loginId: z.string().trim().min(1, "ログインIDを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const errorCodes = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "INVALID_CREDENTIALS",
  "LOGIN_ID_TAKEN",
  "ALREADY_WORKING",
  "NOT_WORKING",
  "CLOCK_OUT_NOT_AFTER_CLOCK_IN",
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
});
export type User = z.infer<typeof userSchema>;

export const userResponseSchema = z.object({ user: userSchema });

export const statusSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("off_duty") }),
  z.object({ kind: z.literal("working"), since: isoDateTime }),
]);
export const statusResponseSchema = z.object({ status: statusSchema });
export type StatusResponse = z.infer<typeof statusResponseSchema>;

export const recordsResponseSchema = z.object({
  month: z.string(),
  days: z.array(
    z.object({
      workDate: z.string(),
      durationMs: z.number(),
      working: z.boolean(),
      shifts: z.array(
        z.object({
          id: z.uuid(),
          clockInAt: isoDateTime,
          clockOutAt: isoDateTime.nullable(),
          durationMs: z.number().nullable(),
        }),
      ),
    }),
  ),
  totalMs: z.number(),
});
export type RecordsResponse = z.infer<typeof recordsResponseSchema>;
