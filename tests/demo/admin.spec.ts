import { expect, test } from "@playwright/test";
import { logInSlowly, logOut, pause, saveRecording } from "./recording";

test("アドミン: ユーザーを追加し権限を変更する", async ({ page }) => {
  await logInSlowly(page, "admin");

  await page
    .getByRole("navigation", { name: "メニュー" })
    .getByRole("link", { name: "ユーザー管理" })
    .click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await pause(page, 2500);

  const form = page.getByRole("region", { name: "ユーザーを追加" });
  await form.getByLabel("ログインID").pressSequentially("tanaka", { delay: 80 });
  await form.getByLabel("表示名").fill("田中 一郎");
  await form.getByLabel("初期パスワード").pressSequentially("tanaka-initial-pass", { delay: 30 });
  await form.getByLabel("権限").selectOption({ label: "一般社員" });
  await pause(page, 1000);
  await form.getByRole("button", { name: "追加する" }).click();
  await expect(form.getByRole("status")).toContainText("田中 一郎（tanaka）を追加しました");
  await pause(page, 2500);

  await page.getByRole("combobox", { name: "田中 一郎の権限" }).selectOption("manager");
  await pause(page, 2500);

  await page.getByRole("combobox", { name: "アドミンの権限" }).selectOption("employee");
  await expect(page.getByRole("region", { name: "ユーザー一覧" }).getByRole("alert")).toBeVisible();
  await pause(page, 3000);

  await logOut(page);
  await saveRecording(page, "admin");
});
