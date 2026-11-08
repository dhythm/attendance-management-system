import { expect, test } from "@playwright/test";
import { workDateOf } from "../../src/domain/attendance";
import { formatWorkDate } from "../../src/shared/format";
import { earlierToday, logIn } from "./demo";

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
  await expect(today.getByRole("cell").nth(1)).toHaveText(/^\d{2}:\d{2} 打刻 〜 勤務中$/);

  await page.getByRole("button", { name: "退勤" }).click();
  await expect(status).toHaveText("勤務外");
  const clockedTimes = /^(\d{2}:\d{2}) 打刻 〜 (\d{2}:\d{2}) 打刻$/;
  await expect(today.getByRole("cell").nth(1)).toHaveText(clockedTimes);
  await expect(today.getByRole("cell").nth(2)).toHaveText("0:00");

  await page.reload();
  await expect(today.getByRole("cell").nth(1)).toHaveText(clockedTimes);

  await test.step("corrects a clock-in that was pressed late", async () => {
    const clockOut = clockedTimes.exec((await today.getByRole("cell").nth(1).textContent()) ?? "");
    const editButton = today.getByRole("button", {
      name: `${formatWorkDate(workDateOf(new Date()))}の勤怠を修正`,
    });
    await editButton.click();
    const dialog = page.getByRole("dialog", { name: "勤怠の修正" });
    await expect(dialog.getByText("修正履歴はありません")).toBeVisible();

    const clockInField = dialog.getByLabel("出勤時刻");
    const clockedIn = await clockInField.inputValue();
    const earlier = earlierToday(clockedIn, 30);
    await clockInField.fill(earlier);
    await dialog.getByLabel("修正理由").fill("出勤の押し忘れ");
    await dialog.getByRole("button", { name: "保存する" }).click();
    await expect(dialog).toBeHidden();

    await expect(today.getByRole("cell").nth(1)).toHaveText(
      `${earlier.slice(11)} 編集 〜 ${clockOut?.[2]} 打刻`,
    );
    await expect(today.getByRole("cell").nth(2)).not.toHaveText("0:00");

    await editButton.click();
    const entry = dialog.getByRole("listitem");
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText("鈴木 花子");
    await expect(entry).toContainText(`出勤 ${clockedIn.slice(11)} → ${earlier.slice(11)}`);
    await expect(entry).toContainText("出勤の押し忘れ");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("self sign-up is not available", async ({ page }) => {
  const response = await page.goto("/signup");
  expect(response?.status()).toBe(404);
});
