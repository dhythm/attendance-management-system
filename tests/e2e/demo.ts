import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "e2e-demo-password";

export async function logIn(page: Page, loginId: string, password = DEMO_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("ログインID").fill(loginId);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/$/);
}
