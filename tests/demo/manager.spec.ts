import { expect, test } from "@playwright/test";
import { currentYearMonth, workDateOf } from "../../src/domain/attendance";
import { formatWorkDate } from "../../src/shared/format";
import { lastWeekdayBefore } from "../e2e/demo";
import { logInSlowly, logOut, pause, saveRecording } from "./recording";

test("マネージャー: 全員の勤務状況を確認し、メンバーの勤怠を修正する", async ({ page }) => {
  await logInSlowly(page, "manager");

  await page
    .getByRole("navigation", { name: "メニュー" })
    .getByRole("link", { name: "勤怠一覧" })
    .click();
  await expect(page).toHaveURL(/\/manager$/);
  await pause(page, 3000);

  await page.getByRole("link", { name: "山田 太郎" }).click();
  await expect(page.getByRole("heading", { name: /山田 太郎/ })).toBeVisible();
  await pause(page, 2500);

  const workDate = lastWeekdayBefore(workDateOf(new Date()));
  if (workDate.slice(0, 7) !== currentYearMonth(new Date())) {
    await page.getByRole("button", { name: "前月" }).click();
  }
  const editButton = page.getByRole("button", { name: `${formatWorkDate(workDate)}の勤怠を修正` });
  await editButton.scrollIntoViewIfNeeded();
  await pause(page, 1000);
  await editButton.click();
  const dialog = page.getByRole("dialog", { name: "勤怠の修正" });
  await pause(page, 1500);
  await dialog.getByLabel("退勤時刻").fill(`${workDate}T19:30`);
  await pause(page, 800);
  await dialog.getByLabel("修正理由").pressSequentially("退勤の打刻漏れ（本人確認済み）", {
    delay: 90,
  });
  await pause(page, 1000);
  await dialog.getByRole("button", { name: "保存する" }).click();
  await expect(dialog).toBeHidden();
  await pause(page, 2500);

  await editButton.click();
  await expect(dialog.getByRole("listitem")).toHaveCount(1);
  await pause(page, 3000);
  await page.keyboard.press("Escape");
  await pause(page, 1500);

  await page
    .getByRole("navigation", { name: "メニュー" })
    .getByRole("link", { name: "勤怠一覧" })
    .click();
  await expect(page).toHaveURL(/\/manager$/);
  await pause(page, 1500);
  await page.getByRole("link", { name: "鈴木 花子" }).click();
  await pause(page, 2500);

  await logOut(page);
  await saveRecording(page, "manager");
});
