import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { UserAdmin } from "@/components/user-admin";
import { requirePageCapability } from "@/server/auth/session-from-cookies";

export const metadata: Metadata = { title: "ユーザー管理 | 勤怠管理" };

export default async function AdminUsersPage() {
  const user = await requirePageCapability("manageUsers");
  return (
    <AppShell user={user}>
      <PageHeader
        eyebrow="ADMIN"
        title="ユーザー管理"
        description="アカウントの発行と、権限の割り当てを行います。"
      />
      <UserAdmin />
    </AppShell>
  );
}
