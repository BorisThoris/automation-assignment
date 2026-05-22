import type { Page } from "playwright";
import { clickFirstVisible } from "../../../shared/controls.js";
import { saveDebugPage } from "../../../shared/debug.js";
import { normalizeWhitespace } from "../../../shared/utils.js";
import { openNotionSettings } from "./notionSettings.js";

export type DeleteAccountResult = {
  email: string;
};

const DELETE_ACCOUNT_PATTERN = /delete (my )?account|delete account/i;

export async function deleteCurrentNotionAccount(page: Page, email: string, profileName?: string): Promise<DeleteAccountResult> {
  await openNotionSettings(page);
  await openMyAccountSettings(page, profileName);
  await clickDeleteAccount(page);
  await confirmDeleteAccount(page, email);
  await waitForAccountDeleted(page);

  return { email };
}

async function openMyAccountSettings(page: Page, profileName?: string): Promise<void> {
  const clickedProfileItem = profileName
    ? await page.getByText(profileName, { exact: true }).first().click({ timeout: 5_000 }).then(() => true, () => false)
    : false;

  const clickedVisibleAccountLabel = clickedProfileItem || await clickVisibleAccountLabel(page);

  if (!clickedVisibleAccountLabel && !await clickAccountProfileItemByDom(page)) {
    await clickFirstVisible(page, [
    page.getByRole("button", { name: /^my account$/i }),
    page.locator('[role="button"]').filter({ hasText: /^My account$/i }).first(),
      page.getByText(/^My account$/i).first()
    ]);
  }

  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return /account security|my account|delete account|email|profile photo|preferred name/i.test(text);
  }, null, { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(750);
}

async function clickVisibleAccountLabel(page: Page): Promise<boolean> {
  const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  const lines = bodyText.split("\n").map(normalizeWhitespace).filter(Boolean);
  const accountIndex = lines.findIndex((line) => /^account$/i.test(line));
  const profileLabel = accountIndex >= 0 ? lines[accountIndex + 1] : undefined;
  if (!profileLabel || /^preferences$/i.test(profileLabel)) return false;

  return page.getByText(profileLabel, { exact: true }).first()
    .click({ timeout: 5_000 })
    .then(() => true, () => false);
}

async function clickAccountProfileItemByDom(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const knownSettingsItems = /^(account|preferences|notifications|mail & calendar|workspace|general|people|import|features|notion ai|connections|notion mcp|public pages|emoji|admin|teamspaces|security|identity|access & billing|upgrade plan)$/i;
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"], div'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const text = (element.innerText || element.textContent || "").trim();
        return rect.width > 0
          && rect.height > 0
          && rect.x < 520
          && style.visibility !== "hidden"
          && style.display !== "none"
          && text.length >= 2
          && text.length <= 80
          && !text.includes("@")
          && !knownSettingsItems.test(text);
      });
    const target = candidates.at(0);
    if (!target) return false;
    target.click();
    return true;
  }).catch(() => false);
}

async function clickDeleteAccount(page: Page): Promise<void> {
  await scrollSettingsPanelToBottom(page);

  const clicked = await clickButtonByText(page, DELETE_ACCOUNT_PATTERN);
  if (clicked) {
    await page.waitForTimeout(1_000);
    return;
  }

  await clickFirstVisible(page, [
    page.getByRole("button", { name: DELETE_ACCOUNT_PATTERN }),
    page.locator('[role="button"]').filter({ hasText: DELETE_ACCOUNT_PATTERN }).last(),
    page.getByText(DELETE_ACCOUNT_PATTERN).last()
  ]);
}

async function confirmDeleteAccount(page: Page, email: string): Promise<void> {
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return /delete account|permanently delete|type|confirm|email/i.test(text);
  }, null, { timeout: 15_000 }).catch(() => undefined);

  await fillVisibleConfirmationInput(page, email)
    || await fillVisibleConfirmationInput(page, "delete")
    || await fillVisibleConfirmationInput(page, "Delete");

  const clicked = await clickButtonByText(page, /delete account|permanently delete|delete|confirm/i);
  if (!clicked) {
    await saveDebugPage(page, "account-delete-confirm-timeout");
    throw new Error("Could not confirm Notion account deletion.");
  }
}

async function waitForAccountDeleted(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return /account deleted|log in|sign in|continue with google/i.test(text)
      || /\/login/.test(location.href);
  }, null, { timeout: 30_000 }).catch(() => undefined);
}

async function scrollSettingsPanelToBottom(page: Page): Promise<void> {
  await page.evaluate(() => {
    const scrollables = Array.from(document.querySelectorAll<HTMLElement>("div"))
      .filter((element) => element.scrollHeight > element.clientHeight + 50);
    const target = scrollables.at(-1) ?? document.scrollingElement;
    target?.scrollTo({ top: target.scrollHeight, behavior: "instant" });
    window.scrollTo(0, document.body.scrollHeight);
  }).catch(() => undefined);
  await page.waitForTimeout(750);
}

async function fillVisibleConfirmationInput(page: Page, value: string): Promise<boolean> {
  const input = page.locator('input[type="text"]:visible, input[type="email"]:visible, input:not([type]):visible, textarea:visible').last();
  if (!await input.isVisible({ timeout: 1_000 }).catch(() => false)) return false;
  await input.fill(value);
  await page.waitForTimeout(300);
  return true;
}

async function clickButtonByText(page: Page, pattern: RegExp): Promise<boolean> {
  return page.evaluate((patternSource) => {
    const textPattern = new RegExp(patternSource, "i");
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const text = (element.innerText || element.textContent || "").trim();
        return rect.width > 0
          && rect.height > 0
          && style.visibility !== "hidden"
          && style.display !== "none"
          && element.getAttribute("aria-disabled") !== "true"
          && !element.hasAttribute("disabled")
          && textPattern.test(text);
      });
    const target = candidates.at(-1);
    if (!target) return false;
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
    return true;
  }, pattern.source).catch(() => false);
}
