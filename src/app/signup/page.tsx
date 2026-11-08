import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { currentUserFromCookies } from "@/server/auth/session-from-cookies";

export const metadata: Metadata = { title: "新規登録 | 勤怠管理" };

export default async function SignupPage() {
  if (await currentUserFromCookies()) redirect("/");
  return <AuthForm mode="signup" />;
}
