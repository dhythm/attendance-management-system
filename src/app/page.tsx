import { Dashboard } from "@/components/dashboard";
import { currentYearMonth } from "@/domain/attendance";
import { requirePageCapability } from "@/server/auth/session-from-cookies";

export default async function HomePage() {
  const user = await requirePageCapability("clock");
  return <Dashboard user={user} initialMonth={currentYearMonth(new Date())} />;
}
