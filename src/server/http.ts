import { type NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { err, ok, type Result } from "@/domain/result";
import type { ErrorCode } from "@/shared/api";

const errors: Record<ErrorCode, { status: number; message: string }> = {
  VALIDATION_ERROR: { status: 400, message: "入力内容に誤りがあります" },
  UNAUTHORIZED: { status: 401, message: "ログインしてください" },
  INVALID_CREDENTIALS: { status: 401, message: "ログインIDまたはパスワードが正しくありません" },
  LOGIN_ID_TAKEN: { status: 409, message: "このログインIDは既に使われています" },
  ALREADY_WORKING: { status: 409, message: "既に出勤しています" },
  NOT_WORKING: { status: 409, message: "出勤していません" },
  CLOCK_OUT_NOT_AFTER_CLOCK_IN: { status: 409, message: "退勤時刻が出勤時刻より前です" },
  INTERNAL_ERROR: { status: 500, message: "サーバーでエラーが発生しました" },
};

export function errorResponse(code: ErrorCode, message = errors[code].message): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status: errors[code].status });
}

export async function parseJsonBody<S extends z.ZodType>(
  request: NextRequest,
  schema: S,
): Promise<Result<z.infer<S>, NextResponse>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return err(errorResponse("VALIDATION_ERROR", "リクエストの形式が正しくありません"));
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? errors.VALIDATION_ERROR.message;
    return err(errorResponse("VALIDATION_ERROR", message));
  }
  return ok(parsed.data);
}

export function withErrorHandling<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error(error);
      return errorResponse("INTERNAL_ERROR");
    }
  };
}
