import type { Page } from "playwright";
import { GOOGLE_LOGIN_BUTTON, SETTINGS_LABEL } from "../../../shared/constants.js";
import { clickNotionButton } from "../../../shared/controls.js";

export async function isLoggedIntoNotion(page: Page): Promise<boolean> {
  if (!page.url().includes("notion.so")) return false;
  const loginButtonVisible = await page.getByRole("button", { name: GOOGLE_LOGIN_BUTTON }).first()
    .isVisible({ timeout: 1_000 })
    .catch(() => false);
  if (loginButtonVisible) return false;

  const settingsVisible = await page.getByText(SETTINGS_LABEL).first()
    .isVisible({ timeout: 2_000 })
    .catch(() => false);
  if (settingsVisible) return true;

  const workspaceVisible = await page.getByText(/home|private|teamspaces|getting started/i).first()
    .isVisible({ timeout: 2_000 })
    .catch(() => false);
  const loginHeadingVisible = await page.getByText(/log in to your notion account/i).first()
    .isVisible({ timeout: 1_000 })
    .catch(() => false);
  return workspaceVisible && !loginHeadingVisible;
}

export async function isNotionOnboarding(page: Page): Promise<boolean> {
  if (!page.url().includes("notion.so")) return false;
  if (page.url().includes("/onboarding")) return true;
  const text = await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
  return /customize your profile|your name|onboarding|tell us about yourself|join teammates|create a workspace|you.ve been invited|choose your plan|continue with free/i.test(text);
}

export async function dismissNotionInterstitials(page: Page): Promise<void> {
  if (!page.url().includes("notion.so")) return;
  await page.keyboard.press("Escape").catch(() => undefined);
  await clickNotionButton(page, [
    /^skip for now$/i,
    /^maybe later$/i,
    /^not now$/i,
    /^dismiss$/i,
    /^done$/i,
    /^close$/i
  ]).catch(() => false);
}
