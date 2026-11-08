import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { UsersOverview } from "@/components/users-overview";
import { currentYearMonth } from "@/domain/attendance";
import { requirePageCapability } from "@/server/auth/session-from-cookies";

export const metadata: Metadata = { title: "勤怠一覧 | 勤怠管理" };

export default async function ManagerPage() {
  const user = await requirePageCapability("viewAllAttendance");
  return (
    <main>
      <AppHeader user={user} />
      <UsersOverview initialMonth={currentYearMonth(new Date())} />
    </main>
  );
}
