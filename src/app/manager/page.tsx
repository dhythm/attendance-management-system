import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { UsersOverview } from "@/components/users-overview";
import { currentYearMonth } from "@/domain/attendance";
import { requirePageCapability } from "@/server/auth/session-from-cookies";

export const metadata: Metadata = { title: "勤怠一覧 | 勤怠管理" };

export default async function ManagerPage() {
  const user = await requirePageCapability("viewAllAttendance");
  return (
    <AppShell user={user}>
      <PageHeader
        eyebrow="TEAM"
        title="勤怠一覧"
        description="メンバーの勤務状況と、月ごとの勤務時間を確認できます。"
      />
      <UsersOverview initialMonth={currentYearMonth(new Date())} />
    </AppShell>
  );
}
