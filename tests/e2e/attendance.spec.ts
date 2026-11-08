import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { workDateOf } from "../../src/domain/attendance";
import { formatWorkDate } from "../../src/shared/format";

test("a new user signs up, logs back in, clocks in and out, and sees the record", async ({
  page,
}) => {
  const loginId = `e2e_${randomUUID().slice(0, 8)}`;
  const password = "e2e-password-1234";

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole("link", { name: "新規登録" }).click();
  await expect(page.getByRole("heading", { name: "新規登録" })).toBeVisible();
  await page.getByLabel("ログインID").fill(loginId);
  await page.getByLabel("表示名").fill("E2E 太郎");
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "登録する" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("E2E 太郎 さん")).toBeVisible();

  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("ログインID").fill(loginId);
  await page.getByLabel("パスワード").fill("wrong-password");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "ログインIDまたはパスワードが正しくありません" }),
  ).toBeVisible();

  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/$/);

  const status = page.getByTestId("status");
  await expect(status).toHaveText("勤務外");
  await expect(page.getByText("この月の記録はありません")).toBeVisible();

  await page.getByRole("button", { name: "出勤" }).click();
  await expect(status).toHaveText(/^勤務中/);
  const records = page.getByRole("region", { name: /の勤怠$/ });
  const today = records
    .getByRole("row")
    .filter({ hasText: formatWorkDate(workDateOf(new Date())) });
  await expect(today).toHaveCount(1);
  await expect(today.getByRole("cell").nth(1)).toHaveText(/^\d{2}:\d{2} 〜 勤務中$/);

  await page.getByRole("button", { name: "退勤" }).click();
  await expect(status).toHaveText("勤務外");
  await expect(today.getByRole("cell").nth(1)).toHaveText(/^\d{2}:\d{2} 〜 \d{2}:\d{2}$/);
  await expect(today.getByRole("cell").nth(2)).toHaveText("0:00");
  await expect(page.getByTestId("monthly-total")).toHaveText("0:00");

  await page.reload();
  await expect(today.getByRole("cell").nth(1)).toHaveText(/^\d{2}:\d{2} 〜 \d{2}:\d{2}$/);

  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});
