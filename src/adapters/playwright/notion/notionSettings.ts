import type { Page } from "playwright";
import { SETTINGS_LABEL } from "../../../shared/constants.js";
import { clickFirstVisible, clickFirstVisibleOptional } from "../../../shared/controls.js";
import { saveDebugPage } from "../../../shared/debug.js";
import { dismissNotionInterstitials } from "./notionDetection.js";

export async function openNotionSettings(page: Page): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await openNotionSettingsOnce(page);
      await waitForNotionSettingsReady(page);
      return;
    } catch (error) {
      lastError = error;
      await saveDebugPage(page, `settings-open-attempt-${attempt}`).catch(() => undefined);
      if (attempt < 3) await recoverBeforeSettingsRetry(page);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not open Notion settings after multiple attempts.");
}

async function openNotionSettingsOnce(page: Page): Promise<void> {
  await dismissNotionInterstitials(page);

  if (await clickFirstVisibleOptional([
    page.getByRole("button", { name: SETTINGS_LABEL }),
    page.getByText(SETTINGS_LABEL).first()
  ])) {
    await waitForNotionSettingsReady(page);
    return;
  }

  await page.keyboard.press("Control+,").catch(() => undefined);
  await page.waitForTimeout(1_000);
  if (await page.getByText(SETTINGS_LABEL).first().isVisible({ timeout: 1_000 }).catch(() => false)) {
    await waitForNotionSettingsReady(page);
    return;
  }

  await page.mouse.click(150, 30).catch(() => undefined);
  await page.waitForTimeout(750);
  if (await clickSettingsMenuItem(page)) return;

  if (await clickFirstVisibleOptional([
    page.getByRole("button", { name: /^more$/i }),
    page.locator('[role="button"]').filter({ hasText: /^More$/i }).first(),
    page.getByText(/^More$/i).first()
  ])) {
    await page.waitForTimeout(750);
    if (await clickSettingsMenuItem(page)) return;
  }

  const openedSwitcher = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('[role="button"], button, [aria-label]'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const text = (element.innerText || element.textContent || element.getAttribute("aria-label") || "").trim();
        return rect.width > 0 && rect.height > 0 && rect.x < 340 && rect.y < 80 && /space|workspace/i.test(text);
      });
    const target = candidates[0];
    if (!target) return false;
    target.click();
    return true;
  }).catch(() => false);

  const openedSidebarHeader = openedSwitcher || await clickSidebarHeader(page);
  if (!openedSidebarHeader) {
    await saveDebugPage(page, "workspace-switcher-timeout");
    throw new Error("Could not open the Notion workspace switcher.");
  }
  await page.waitForTimeout(750);
  if (!await clickSettingsMenuItem(page)) {
    await clickFirstVisible(page, settingsLocators(page));
  }
}

async function recoverBeforeSettingsRetry(page: Page): Promise<void> {
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(500);
  await dismissNotionInterstitials(page).catch(() => undefined);

  if (page.url().includes("notion.so")) {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(1_500);
  }
}

async function clickSidebarHeader(page: Page): Promise<boolean> {
  await page.mouse.click(160, 44).catch(() => undefined);
  await page.waitForTimeout(500);
  if (await clickSettingsMenuItem(page)) return true;

  return page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('[role="button"], button, [aria-label], div'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0
          && rect.height > 0
          && rect.x < 360
          && rect.y < 120
          && style.visibility !== "hidden"
          && style.display !== "none";
      });
    const target = candidates.at(-1);
    if (!target) return false;
    target.click();
    return true;
  }).catch(() => false);
}

async function clickSettingsMenuItem(page: Page): Promise<boolean> {
  if (!await clickFirstVisibleOptional(settingsLocators(page)) && !await clickSettingsMenuItemByDom(page)) return false;
  await waitForNotionSettingsReady(page);
  return true;
}

async function clickSettingsMenuItemByDom(page: Page): Promise<boolean> {
  return page.evaluate((patternSource) => {
    const pattern = new RegExp(patternSource, "i");
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"], [role="menuitem"], div'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const text = (element.innerText || element.textContent || "").trim();
        return rect.width > 0
          && rect.height > 0
          && style.visibility !== "hidden"
          && style.display !== "none"
          && pattern.test(text);
      });
    const target = candidates.find((element) => {
      const text = (element.innerText || element.textContent || "").trim();
      return /^settings|settings & members$/i.test(text);
    }) ?? candidates.at(0);
    if (!target) return false;
    target.click();
    return true;
  }, SETTINGS_LABEL.source).catch(() => false);
}

function settingsLocators(page: Page) {
  return [
    page.getByRole("menuitem", { name: SETTINGS_LABEL }),
    page.getByRole("button", { name: SETTINGS_LABEL }),
    page.locator('[role="menuitem"]').filter({ hasText: SETTINGS_LABEL }).first(),
    page.locator('[role="button"]').filter({ hasText: SETTINGS_LABEL }).first(),
    page.getByText(SETTINGS_LABEL).first()
  ];
}

async function waitForNotionSettingsReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return /Account/i.test(text) && /Workspace/i.test(text) && /People/i.test(text);
  }, null, { timeout: 30_000 });
  await page.waitForTimeout(750);
}
