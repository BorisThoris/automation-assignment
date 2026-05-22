import type { Page } from "playwright";
import { clickFirstVisible } from "../../../shared/controls.js";
import { saveDebugPage } from "../../../shared/debug.js";
import { normalizeWhitespace } from "../../../shared/utils.js";
import { openNotionSettings } from "./notionSettings.js";

export type DeleteWorkspaceResult = {
  workspaceName: string;
};

const DELETE_WORKSPACE_PATTERN = /delete (entire )?workspace/i;

export async function deleteCurrentNotionWorkspace(page: Page, expectedWorkspaceName?: string): Promise<DeleteWorkspaceResult> {
  await openNotionSettings(page);
  await openWorkspaceGeneralSettings(page);

  const workspaceName = expectedWorkspaceName?.trim() || await inferWorkspaceName(page);
  if (!workspaceName) {
    await saveDebugPage(page, "workspace-name-timeout");
    throw new Error("Could not infer the Notion workspace name. Set NOTION_WORKSPACE_DELETE_NAME to the exact workspace name and retry.");
  }

  await clickDeleteWorkspace(page);
  await confirmDeleteWorkspace(page, workspaceName);
  await waitForWorkspaceDeleted(page);

  return { workspaceName };
}

async function openWorkspaceGeneralSettings(page: Page): Promise<void> {
  await clickFirstVisible(page, [
    page.getByRole("button", { name: /^general$/i }),
    page.locator('[role="button"]').filter({ hasText: /^General$/i }).first(),
    page.getByText(/^General$/i).first()
  ]);

  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return /workspace settings|danger zone|delete workspace|delete entire workspace/i.test(text);
  }, null, { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(1_000);
}

async function inferWorkspaceName(page: Page): Promise<string | undefined> {
  const fromEditable = await page.locator([
    'input[aria-label*="workspace" i]:visible',
    'input[value]:visible'
  ].join(", ")).evaluateAll((elements) => {
    return elements
      .map((element) => (element as HTMLInputElement).value?.trim())
      .find((value) => value && !/^https?:\/\//i.test(value) && value.length >= 2);
  }).catch(() => undefined);

  if (fromEditable) return fromEditable;

  const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  const lines = bodyText.split("\n").map(normalizeWhitespace).filter(Boolean);
  const nameLineIndex = lines.findIndex((line) => /^name$/i.test(line));
  const afterName = nameLineIndex >= 0 ? lines[nameLineIndex + 1] : undefined;
  if (afterName && looksLikeWorkspaceName(afterName)) return afterName;

  const titledWorkspaceLine = lines.find((line) => looksLikeWorkspaceName(line) && /\b(space|workspace)\b/i.test(line));
  if (titledWorkspaceLine) return titledWorkspaceLine;

  return lines.find((line) => looksLikeWorkspaceName(line));
}

function looksLikeWorkspaceName(value: string): boolean {
  return value.length >= 2
    && value.length <= 80
    && !value.includes("@")
    && !/^(skip to content|general|settings|workspace|workspace settings|account|people|members|danger zone|delete workspace)$/i.test(value);
}

async function clickDeleteWorkspace(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
  await page.waitForTimeout(750);

  const clicked = await page.evaluate((patternSource) => {
    const pattern = new RegExp(patternSource, "i");
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
          && pattern.test(text);
      });
    const target = candidates.at(-1);
    if (!target) return false;
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
    return true;
  }, DELETE_WORKSPACE_PATTERN.source).catch(() => false);

  if (clicked) {
    await page.waitForTimeout(1_000);
    return;
  }

  await clickFirstVisible(page, [
    page.getByRole("button", { name: DELETE_WORKSPACE_PATTERN }),
    page.locator('[role="button"]').filter({ hasText: DELETE_WORKSPACE_PATTERN }).last(),
    page.getByText(DELETE_WORKSPACE_PATTERN).last()
  ]);
}

async function confirmDeleteWorkspace(page: Page, workspaceName: string): Promise<void> {
  await page.waitForFunction(() => /delete workspace|delete entire workspace|permanently delete|type/i.test(document.body.innerText), null, { timeout: 15_000 })
    .catch(() => undefined);

  const typedConfirmation = await fillConfirmationInput(page, workspaceName)
    || await fillConfirmationInput(page, "delete")
    || await fillConfirmationInput(page, "Delete");

  const clicked = await clickConfirmDeleteButton(page);
  if (!clicked) {
    await saveDebugPage(page, "workspace-delete-confirm-timeout");
    throw new Error(`Could not confirm workspace deletion${typedConfirmation ? "" : " because no confirmation input was found"}.`);
  }
}

async function fillConfirmationInput(page: Page, value: string): Promise<boolean> {
  const input = page.locator('input[type="text"]:visible, input:not([type]):visible, textarea:visible').last();
  if (!await input.isVisible({ timeout: 1_000 }).catch(() => false)) return false;
  await input.fill(value);
  await page.waitForTimeout(300);
  return true;
}

async function clickConfirmDeleteButton(page: Page): Promise<boolean> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const clicked = await page.evaluate(() => {
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
            && /^delete|permanently delete|confirm$/i.test(text);
        });
      const target = candidates.at(-1);
      if (!target) return false;
      target.click();
      return true;
    }).catch(() => false);

    if (clicked) return true;
    await page.waitForTimeout(750);
  }

  return false;
}

async function waitForWorkspaceDeleted(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return /workspace has been deleted|create a new workspace|onboarding|log in|sign in/i.test(text)
      || /\/onboarding|\/login/.test(location.href);
  }, null, { timeout: 30_000 }).catch(() => undefined);
}
