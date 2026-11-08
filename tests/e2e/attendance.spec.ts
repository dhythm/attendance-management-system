import { expect, test } from "@playwright/test";
import { workDateOf } from "../../src/domain/attendance";
import { formatWorkDate } from "../../src/shared/format";
import { logIn } from "./demo";

test("an employee logs in, clocks in and out, and sees today's record", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("ログインID").fill("suzuki");
  await page.getByLabel("パスワード").fill("wrong-password");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "ログインIDまたはパスワードが正しくありません" }),
  ).toBeVisible();

  await logIn(page, "suzuki");
  await expect(page.getByText("鈴木 花子 さん")).toBeVisible();

  const status = page.getByTestId("status");
  await expect(status).toHaveText("勤務外");
  const records = page.getByRole("region", { name: /の勤怠$/ });
  const today = records
    .getByRole("row")
    .filter({ hasText: formatWorkDate(workDateOf(new Date())) });
  await expect(today).toHaveCount(0);

  await page.getByRole("button", { name: "出勤" }).click();
  await expect(status).toHaveText(/^勤務中/);
  await expect(today).toHaveCount(1);
  await expect(today.getByRole("cell").nth(1)).toHaveText(/^\d{2}:\d{2} 〜 勤務中$/);

  await page.getByRole("button", { name: "退勤" }).click();
  await expect(status).toHaveText("勤務外");
  await expect(today.getByRole("cell").nth(1)).toHaveText(/^\d{2}:\d{2} 〜 \d{2}:\d{2}$/);
  await expect(today.getByRole("cell").nth(2)).toHaveText("0:00");

  await page.reload();
  await expect(today.getByRole("cell").nth(1)).toHaveText(/^\d{2}:\d{2} 〜 \d{2}:\d{2}$/);

  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("self sign-up is not available", async ({ page }) => {
  const response = await page.goto("/signup");
  expect(response?.status()).toBe(404);
});
