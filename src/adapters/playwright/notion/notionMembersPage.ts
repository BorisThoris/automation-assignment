import type { Page } from "playwright";
import { MEMBERS_LABEL } from "../../../shared/constants.js";
import { clickFirstVisible } from "../../../shared/controls.js";
import type { Member } from "../../../shared/types.js";
import { extractMembersFromTextSources } from "../../../domain/memberExtraction.js";
import { openNotionSettings } from "./notionSettings.js";

export async function openMembersPage(page: Page, workspaceUrl: string): Promise<void> {
  if (!page.url().includes("notion.so")) {
    await page.goto(workspaceUrl, { waitUntil: "domcontentloaded" });
  }

  await openNotionSettings(page);

  await clickFirstVisible(page, [
    page.getByRole("button", { name: /^people$/i }),
    page.locator('[role="button"]').filter({ hasText: /^People$/i }).first(),
    page.getByText(/^People$/i).first()
  ]);

  await page.waitForFunction(() => /Manage people in your workspace/i.test(document.body.innerText), null, { timeout: 30_000 }).catch(() => undefined);

  await clickFirstVisible(page, [
    page.getByRole("tab", { name: MEMBERS_LABEL }),
    page.getByRole("button", { name: MEMBERS_LABEL }),
    page.getByText(MEMBERS_LABEL).first()
  ]);

  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(1_000);
}

export async function extractMembers(page: Page): Promise<Member[]> {
  const rows = page.locator('[role="row"], [data-testid*="member" i], div:has-text("@")');
  const count = await rows.count();
  const rowTexts: string[] = [];

  for (let index = 0; index < count; index += 1) {
    rowTexts.push(await rows.nth(index).innerText().catch(() => ""));
  }

  const text = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  return extractMembersFromTextSources(rowTexts, text);
}
