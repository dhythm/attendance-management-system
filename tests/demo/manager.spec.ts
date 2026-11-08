import { expect, test } from "@playwright/test";
import { logInSlowly, logOut, pause, saveRecording } from "./recording";

test("マネージャー: 全員の勤務状況と個人の勤怠を確認する", async ({ page }) => {
  await logInSlowly(page, "manager");

  await page
    .getByRole("navigation", { name: "メニュー" })
    .getByRole("link", { name: "勤怠一覧" })
    .click();
  await expect(page).toHaveURL(/\/manager$/);
  await pause(page, 3000);

  await page.getByRole("link", { name: "山田 太郎" }).click();
  await expect(page.getByRole("heading", { name: /山田 太郎/ })).toBeVisible();
  await pause(page, 3000);

  await page.getByRole("button", { name: "前月" }).click();
  await pause(page, 2000);

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
