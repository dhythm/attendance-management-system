import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { logIn } from "./demo";

test("an admin creates an employee who can then log in", async ({ page }) => {
  const loginId = `e2e_${randomUUID().slice(0, 8)}`;
  const password = "new-employee-password";

  await logIn(page, "admin");
  await page
    .getByRole("navigation", { name: "メニュー" })
    .getByRole("link", { name: "ユーザー管理" })
    .click();
  await expect(page).toHaveURL(/\/admin\/users$/);

  const form = page.getByRole("region", { name: "ユーザーを追加" });
  await form.getByLabel("ログインID").fill(loginId);
  await form.getByLabel("表示名").fill("E2E 新入");
  await form.getByLabel("初期パスワード").fill(password);
  await form.getByLabel("権限").selectOption({ label: "一般社員" });
  await form.getByRole("button", { name: "追加する" }).click();
  await expect(form.getByRole("status")).toHaveText(`E2E 新入（${loginId}）を追加しました`);

  const row = page
    .getByRole("region", { name: "ユーザー一覧" })
    .getByRole("row")
    .filter({ hasText: loginId });
  await expect(row.getByRole("combobox", { name: "E2E 新入の権限" })).toHaveValue("employee");

  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await logIn(page, loginId, password);
  await expect(page.getByText("E2E 新入 さん")).toBeVisible();
  await expect(page.getByTestId("status")).toHaveText("勤務外");
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/$/);
});

test("the only admin cannot remove their own admin role", async ({ page }) => {
  await logIn(page, "admin");
  await page.goto("/admin/users");

  const select = page.getByRole("combobox", { name: "アドミンの権限" });
  await select.selectOption("employee");

  await expect(page.getByRole("region", { name: "ユーザー一覧" }).getByRole("alert")).toHaveText(
    "最後のアドミンの権限は変更できません",
  );
  await expect(select).toHaveValue("admin");
});
