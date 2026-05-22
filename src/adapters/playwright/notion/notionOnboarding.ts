import type { Page } from "playwright";
import type { AppConfig } from "../../../app/config.js";
import { clickIfVisible, clickNotionButton, clickNotionExactTextButton } from "../../../shared/controls.js";
import { dismissNotionInterstitials, isNotionOnboarding } from "./notionDetection.js";

export async function completeNotionOnboarding(page: Page, config: AppConfig): Promise<void> {
  for (let step = 0; step < 12; step += 1) {
    await dismissNotionInterstitials(page);
    if (!page.url().includes("notion.so") || !await isNotionOnboarding(page)) return;

    await clickIfVisible(page.getByRole("button", { name: /reject all/i }).first());

    const profileInput = page.locator('input[type="text"]:visible').first();
    if (await profileInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await profileInput.fill(config.notionProfileName);
    }

    const marketingOptOut = page.locator('input[type="checkbox"]:visible').first();
    if (await marketingOptOut.isVisible({ timeout: 1_000 }).catch(() => false)) {
      const checked = await marketingOptOut.isChecked().catch(() => true);
      if (!checked) await marketingOptOut.check().catch(() => undefined);
    }

    await selectNotionUsageIfPresent(page, config.notionUsage);

    if (await clickNotionInviteCard(page) || await clickNotionExactTextButton(page, ["Join", "Join workspace", "Create workspace"])) {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(1_000);
      continue;
    }

    if (await clickNotionButton(page, [
      /^continue with free$/i,
      /^free$/i,
      /^continue$/i,
      /^next$/i,
      /^skip$/i,
      /^get started$/i,
      /^for myself$/i,
      /^personal$/i
    ])) {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(1_000);
      continue;
    }

    return;
  }
}

async function selectNotionUsageIfPresent(page: Page, usage: AppConfig["notionUsage"]): Promise<void> {
  const usageLabel = {
    work: "For work",
    personal: "For personal life",
    school: "For school"
  }[usage];

  const clicked = await page.evaluate((label) => {
    const target = Array.from(document.querySelectorAll<HTMLElement>('[role="button"], button'))
      .find((element) => {
        const rect = element.getBoundingClientRect();
        const text = (element.innerText || element.textContent || "").trim();
        return rect.width > 0 && rect.height > 0 && text.toLowerCase().startsWith(label.toLowerCase());
      });
    if (!target) return false;
    target.click();
    return true;
  }, usageLabel).catch(() => false);

  if (clicked) {
    await page.waitForTimeout(500);
    return;
  }

  const option = page.getByText(usageLabel, { exact: false }).first();
  if (await option.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await option.click({ timeout: 5_000 }).catch(async () => option.dispatchEvent("click"));
    await page.waitForTimeout(500);
  }
}

async function clickNotionInviteCard(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const target = Array.from(document.querySelectorAll<HTMLElement>('[role="button"], button'))
      .find((element) => {
        const rect = element.getBoundingClientRect();
        const text = (element.innerText || element.textContent || "").trim().toLowerCase();
        return rect.width > 0
          && rect.height > 0
          && text.includes("join")
          && text.includes("member")
          && !text.includes("create workspace");
      });
    if (!target) return false;
    target.click();
    return true;
  }).catch(() => false);
}
