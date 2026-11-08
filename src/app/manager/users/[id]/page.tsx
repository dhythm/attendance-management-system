import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { UserRecords } from "@/components/user-records";
import { currentYearMonth } from "@/domain/attendance";
import { requirePageCapability } from "@/server/auth/session-from-cookies";
import { getDb } from "@/server/db/client";
import { findUserById, parseUserId } from "@/server/repositories/users";

export const metadata: Metadata = { title: "個人の勤怠 | 勤怠管理" };

export default async function UserRecordsPage({ params }: PageProps<"/manager/users/[id]">) {
  const viewer = await requirePageCapability("viewAllAttendance");
  const userId = parseUserId((await params).id);
  const target = userId && (await findUserById(await getDb(), userId));
  if (!target) notFound();

  return (
    <main>
      <AppHeader user={viewer} />
      <p>
        <Link href="/manager">← 勤怠一覧へ戻る</Link>
      </p>
      <h2 className="page-title">
        {target.displayName}（{target.loginId}）さんの勤怠
      </h2>
      <UserRecords userId={target.id} initialMonth={currentYearMonth(new Date())} />
    </main>
  );
}
