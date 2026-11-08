import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { currentYearMonth } from "@/domain/attendance";
import { currentUserFromCookies } from "@/server/auth/session-from-cookies";

export default async function HomePage() {
  const user = await currentUserFromCookies();
  if (!user) redirect("/login");
  return <Dashboard displayName={user.displayName} initialMonth={currentYearMonth(new Date())} />;
}
