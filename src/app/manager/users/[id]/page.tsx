import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Avatar, RoleBadge } from "@/components/identity";
import { UserRecords } from "@/components/user-records";
import { currentYearMonth } from "@/domain/attendance";
import { canEditAttendance } from "@/domain/role";
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
    <AppShell user={viewer}>
      <Link href="/manager" className="back-link">
        <ArrowLeft size={15} />
        勤怠一覧へ戻る
      </Link>
      <header className="person">
        <Avatar name={target.displayName} seed={target.id} large />
        <div>
          <h1 className="page-title">{target.displayName}</h1>
          <p className="page-sub">
            <span className="num">{target.loginId}</span> ・ <RoleBadge role={target.role} />
          </p>
        </div>
      </header>
      <UserRecords
        userId={target.id}
        initialMonth={currentYearMonth(new Date())}
        canEdit={canEditAttendance(viewer.role, viewer.id === target.id)}
      />
    </AppShell>
  );
}
