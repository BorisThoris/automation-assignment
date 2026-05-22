import type { Locator, Page } from "playwright";
import path from "node:path";
import { debugOutputDir, saveDebugPage } from "./debug.js";
import { escapeRegExp, timestampForFile } from "./utils.js";

export async function fillIfVisible(page: Page, locator: Locator, value: string): Promise<void> {
  await locator.waitFor({ state: "visible", timeout: 30_000 }).catch(async (error) => {
    await saveDebugPage(page, "field-timeout");
    throw error;
  });
  await locator.fill(value);
}

export async function clickFirstVisible(page: Page, locators: Locator[]): Promise<void> {
  if (await clickFirstVisibleOptional(locators, 5_000)) return;
  await page.screenshot({ path: path.resolve(debugOutputDir(), `debug-${timestampForFile()}.png`), fullPage: true }).catch(() => undefined);
  await saveDebugPage(page, "click-control-timeout").catch(() => undefined);
  throw new Error("Could not find an expected clickable control.");
}

export async function clickFirstVisibleOptional(locators: Locator[], timeout = 1_000): Promise<boolean> {
  for (const locator of locators) {
    const target = locator.first();
    if (await target.isVisible({ timeout }).catch(() => false)) {
      const clicked = await target.click({ timeout: 5_000 }).then(() => true, () => false);
      if (clicked) return true;
    }
  }
  return false;
}

export async function clickIfVisible(locator: Locator): Promise<boolean> {
  if (await locator.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await locator.click();
    return true;
  }
  return false;
}

export async function clickNotionButton(page: Page, patterns: RegExp[]): Promise<boolean> {
  for (const pattern of patterns) {
    const roleButton = page.locator('[role="button"]').filter({ hasText: pattern }).first();
    if (await roleButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await roleButton.click({ timeout: 5_000 }).catch(async () => {
        await roleButton.dispatchEvent("click");
      });
      return true;
    }

    const button = page.getByRole("button", { name: pattern }).first();
    if (await clickIfVisible(button)) return true;
  }

  return page.evaluate((patternSources) => {
    const patterns = patternSources.map((source) => new RegExp(source, "i"));
    const elements = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]'));
    const target = elements.find((element) => {
      const rect = element.getBoundingClientRect();
      const text = (element.innerText || element.textContent || "").trim();
      return rect.width > 0
        && rect.height > 0
        && patterns.some((pattern) => pattern.test(text));
    });
    if (!target) return false;
    target.click();
    return true;
  }, patterns.map((pattern) => pattern.source)).catch(() => false);
}

export async function clickNotionExactTextButton(page: Page, labels: string[]): Promise<boolean> {
  const clicked = await page.evaluate((buttonLabels) => {
    const normalizedLabels = buttonLabels.map((label) => label.trim().toLowerCase());
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0
          && rect.height > 0
          && style.visibility !== "hidden"
          && style.display !== "none"
          && !element.hasAttribute("disabled")
          && element.getAttribute("aria-disabled") !== "true";
      })
      .map((element) => ({
        element,
        text: (element.innerText || element.textContent || "").trim().toLowerCase()
      }))
      .filter(({ text }) => normalizedLabels.includes(text));

    const target = candidates[0]?.element;
    if (!target) return false;
    target.click();
    return true;
  }, labels).catch(() => false);

  if (clicked) return true;

  for (const label of labels) {
    const button = page.getByRole("button", { name: new RegExp(`^${escapeRegExp(label)}$`, "i") }).first();
    if (await clickIfVisible(button)) return true;
  }

  return false;
}

export async function clickGoogleChallengeOption(page: Page, patterns: RegExp[]): Promise<boolean> {
  for (const pattern of patterns) {
    const locators = [
      page.getByRole("button", { name: pattern }).first(),
      page.getByRole("link", { name: pattern }).first(),
      page.locator('[role="button"]').filter({ hasText: pattern }).first(),
      page.locator("li").filter({ hasText: pattern }).first(),
      page.getByText(pattern).first()
    ];

    for (const locator of locators) {
      if (await clickIfVisible(locator)) return true;
    }
  }

  return false;
}
