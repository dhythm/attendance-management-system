import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { UserAdmin } from "@/components/user-admin";
import { requirePageCapability } from "@/server/auth/session-from-cookies";

export const metadata: Metadata = { title: "ユーザー管理 | 勤怠管理" };

export default async function AdminUsersPage() {
  const user = await requirePageCapability("manageUsers");
  return (
    <main>
      <AppHeader user={user} />
      <UserAdmin />
    </main>
  );
}
