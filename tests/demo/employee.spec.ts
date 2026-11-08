import { expect, test } from "@playwright/test";
import { logInSlowly, logOut, pause, saveRecording } from "./recording";

test("一般社員: 出勤・退勤して勤怠を確認する", async ({ page }) => {
  await logInSlowly(page, "suzuki");

  await page.getByRole("button", { name: "出勤" }).click();
  await expect(page.getByTestId("status")).toHaveText(/^勤務中/);
  await pause(page, 2500);

  await page.getByRole("button", { name: "退勤" }).click();
  await expect(page.getByTestId("status")).toHaveText("勤務外");
  await pause(page, 2500);

  await page.getByRole("button", { name: "前月" }).click();
  await pause(page, 2000);
  await page.getByRole("button", { name: "翌月" }).click();
  await pause(page);

  await logOut(page);
  await saveRecording(page, "employee");
});
