import type { BrowserContext, Page } from "playwright";
import type { AppConfig } from "../../../app/config.js";
import { debugOutputDir, saveContextDebug } from "../../../shared/debug.js";
import { dismissNotionInterstitials, isLoggedIntoNotion, isNotionOnboarding } from "./notionDetection.js";
import { completeNotionOnboarding } from "./notionOnboarding.js";

export async function waitForNotionLanding(context: BrowserContext, originalPage: Page, authPage: Page, timeoutMs = 120_000): Promise<Page> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const pages = Array.from(new Set([originalPage, authPage, ...context.pages()]));
    for (const page of pages) {
      if (page.isClosed() || !page.url().includes("notion.so")) continue;
      if (await isLoggedIntoNotion(page) || await isNotionOnboarding(page)) return page;
    }
    const waitPage = pages.find((page) => !page.isClosed());
    if (!waitPage) return originalPage;
    await waitPage.waitForTimeout(1_000).catch(() => undefined);
  }

  throw new Error("Timed out waiting for Notion landing page after Google login.");
}

export async function waitForNotionWorkspace(
  context: BrowserContext,
  originalPage: Page,
  authPage: Page,
  config: AppConfig,
  outputDir: string,
  timeoutMs = 180_000
): Promise<Page> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const pages = Array.from(new Set([originalPage, authPage, ...context.pages()]));
    for (const page of pages) {
      if (page.isClosed()) continue;
      await dismissNotionInterstitials(page);
      if (page.url().includes("notion.so") && await isNotionOnboarding(page)) {
        await completeNotionOnboarding(page, config);
      }
      if (page.url().includes("notion.so") && await isLoggedIntoNotion(page)) return page;
    }
    const waitPage = pages.find((page) => !page.isClosed());
    if (!waitPage) return originalPage;
    await waitPage.waitForTimeout(1_000).catch(() => undefined);
  }

  await saveContextDebug(context, debugOutputDir(outputDir), "notion-workspace-timeout");
  throw new Error("Timed out waiting for Notion workspace after Google login.");
}
