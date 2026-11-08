import { expect, test } from "@playwright/test";
import { currentYearMonth, shiftMonth, workDateOf } from "../../src/domain/attendance";
import { formatWorkDate, formatYearMonth } from "../../src/shared/format";
import { lastWeekdayBefore, logIn } from "./demo";

test("a manager sees who is working and opens a user's monthly records", async ({ page }) => {
  await logIn(page, "manager");
  await page
    .getByRole("navigation", { name: "メニュー" })
    .getByRole("link", { name: "勤怠一覧" })
    .click();
  await expect(page).toHaveURL(/\/manager$/);

  const overview = page.getByRole("region", { name: /の勤怠一覧$/ });
  const yamada = overview.getByRole("row").filter({ hasText: "山田 太郎" });
  await expect(yamada).toContainText("勤務中");
  await expect(yamada).toContainText(/\d{2}:\d{2} 出勤/);
  await expect(overview.getByRole("row").filter({ hasText: "アドミン" })).toContainText("勤務外");

  await yamada.getByRole("link", { name: "山田 太郎" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "山田 太郎" })).toBeVisible();
  const today = page
    .getByRole("region", { name: /の勤怠$/ })
    .getByRole("row")
    .filter({ hasText: formatWorkDate(workDateOf(new Date())) });
  await expect(today.getByRole("cell").nth(1)).toHaveText(/^\d{2}:\d{2} 打刻 〜 勤務中$/);

  await page.getByRole("button", { name: "前月" }).click();
  const previousMonth = formatYearMonth(shiftMonth(currentYearMonth(new Date()), -1));
  await expect(page.getByRole("heading", { name: `${previousMonth}の勤怠` })).toBeVisible();
});

test("a manager corrects a member's past record and sees it in the history", async ({ page }) => {
  await logIn(page, "manager");
  await page.goto("/manager");
  await page.getByRole("link", { name: "山田 太郎" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "山田 太郎" })).toBeVisible();

  const workDate = lastWeekdayBefore(workDateOf(new Date()));
  if (workDate.slice(0, 7) !== currentYearMonth(new Date())) {
    await page.getByRole("button", { name: "前月" }).click();
  }
  const row = page
    .getByRole("region", { name: /の勤怠$/ })
    .getByRole("row")
    .filter({ hasText: formatWorkDate(workDate) });
  const editButton = row.getByRole("button", { name: `${formatWorkDate(workDate)}の勤怠を修正` });
  await editButton.click();

  const dialog = page.getByRole("dialog", { name: "勤怠の修正" });
  await dialog.getByLabel("退勤時刻").fill(`${workDate}T19:15`);
  await dialog.getByLabel("修正理由").fill("E2E 退勤時刻の修正");
  await dialog.getByRole("button", { name: "保存する" }).click();
  await expect(dialog).toBeHidden();
  await expect(row.getByRole("cell").nth(1)).toHaveText(/^\d{2}:\d{2} 打刻 〜 19:15 編集$/);

  await editButton.click();
  const entry = dialog.getByRole("listitem").filter({ hasText: "E2E 退勤時刻の修正" });
  await expect(entry).toContainText("マネージャー 佐藤");
  await expect(entry).toContainText(/退勤 \d{2}:\d{2} → 19:15/);
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(dialog).toBeHidden();
});

test("an employee cannot open the manager view", async ({ page }) => {
  await logIn(page, "suzuki");
  await expect(
    page.getByRole("navigation", { name: "メニュー" }).getByRole("link", { name: "勤怠一覧" }),
  ).toHaveCount(0);
  await page.goto("/manager");
  await expect(page).toHaveURL(/\/$/);
});
