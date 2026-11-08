import { expect, test } from "@playwright/test";
import { workDateOf } from "../../src/domain/attendance";
import { formatWorkDate } from "../../src/shared/format";
import { earlierToday } from "../e2e/demo";
import { logInSlowly, logOut, pause, saveRecording } from "./recording";

test("一般社員: 出勤・退勤し、打刻の誤りを修正して勤怠を確認する", async ({ page }) => {
  await logInSlowly(page, "suzuki");

  await page.getByRole("button", { name: "出勤" }).click();
  await expect(page.getByTestId("status")).toHaveText(/^勤務中/);
  await pause(page, 2500);

  await page.getByRole("button", { name: "退勤" }).click();
  await expect(page.getByTestId("status")).toHaveText("勤務外");
  await pause(page, 2000);

  const today = formatWorkDate(workDateOf(new Date()));
  const editButton = page.getByRole("button", { name: `${today}の勤怠を修正` });
  await editButton.scrollIntoViewIfNeeded();
  await pause(page, 1000);
  await editButton.click();
  const dialog = page.getByRole("dialog", { name: "勤怠の修正" });
  await pause(page, 1500);
  const clockIn = dialog.getByLabel("出勤時刻");
  await clockIn.fill(earlierToday(await clockIn.inputValue(), 30));
  await pause(page, 800);
  await dialog.getByLabel("修正理由").pressSequentially("出勤の押し忘れ", { delay: 120 });
  await pause(page, 1000);
  await dialog.getByRole("button", { name: "保存する" }).click();
  await expect(dialog).toBeHidden();
  await pause(page, 2500);

  await editButton.click();
  await expect(dialog.getByRole("listitem")).toHaveCount(1);
  await pause(page, 3000);
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await pause(page, 1500);

  await page.getByRole("button", { name: "前月" }).click();
  await pause(page, 2000);
  await page.getByRole("button", { name: "翌月" }).click();
  await pause(page);

  await logOut(page);
  await saveRecording(page, "employee");
});
