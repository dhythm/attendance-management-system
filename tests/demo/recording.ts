import type { Page } from "@playwright/test";
import { DEMO_PASSWORD } from "../e2e/demo";

export function pause(page: Page, ms = 1500) {
  return page.waitForTimeout(ms);
}

export async function logInSlowly(page: Page, loginId: string, password = DEMO_PASSWORD) {
  await page.goto("/login");
  await pause(page, 800);
  await page.getByLabel("ログインID").pressSequentially(loginId, { delay: 80 });
  await page.getByLabel("パスワード").pressSequentially(password, { delay: 40 });
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL(/\/$/);
  await pause(page);
}

export async function logOut(page: Page) {
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.waitForURL(/\/login$/);
  await pause(page, 1000);
}

export async function saveRecording(page: Page, name: string) {
  const video = page.video();
  if (!video) throw new Error("video recording is not enabled");
  await page.close();
  await video.saveAs(`docs/demo/${name}.webm`);
}
