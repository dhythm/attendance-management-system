import type { z } from "zod";
import { ensureAdmin } from "@/server/bootstrap-admin";
import { closeDb, getDb } from "@/server/db/client";
import { displayNameSchema, loginIdSchema, passwordSchema } from "@/shared/api";

function readEnv(name: string, schema: z.ZodType<string>) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} を設定してください`);
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`${name} が不正です: ${parsed.error.issues[0]?.message}`);
  return parsed.data;
}

const messages = {
  CREATED: "管理者アカウントを作成しました",
  ALREADY_ADMIN: "管理者アカウントは既に存在します（変更していません）",
  LOGIN_ID_TAKEN: "このログインIDは管理者以外のアカウントで使われています",
} as const;

async function main() {
  const input = {
    loginId: readEnv("ADMIN_LOGIN_ID", loginIdSchema),
    displayName: readEnv("ADMIN_DISPLAY_NAME", displayNameSchema),
    password: readEnv("ADMIN_PASSWORD", passwordSchema),
  };
  const result = await ensureAdmin(await getDb(), input);
  if (result === "LOGIN_ID_TAKEN") throw new Error(`${messages[result]}: ${input.loginId}`);
  console.log(`${messages[result]}: ${input.loginId}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
