import { expect, type Page } from "@playwright/test";
import type { WorkDate } from "../../src/domain/attendance";
import { fromTokyoDateTimeLocal, isWeekend, toTokyoDateTimeLocal } from "../../src/shared/format";

export const DEMO_PASSWORD = "e2e-demo-password";

export async function logIn(page: Page, loginId: string, password = DEMO_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("ログインID").fill(loginId);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/$/);
}

export function earlierToday(dateTimeLocal: string, minutes: number): string {
  const midnight = new Date(`${dateTimeLocal.slice(0, 10)}T00:00:00+09:00`).getTime();
  const earlier = new Date(fromTokyoDateTimeLocal(dateTimeLocal)).getTime() - minutes * 60_000;
  return toTokyoDateTimeLocal(new Date(Math.max(midnight, earlier)).toISOString());
}

export function lastWeekdayBefore(workDate: WorkDate): WorkDate {
  let day = workDate;
  do {
    day = new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000)
      .toISOString()
      .slice(0, 10) as WorkDate;
  } while (isWeekend(day));
  return day;
}
