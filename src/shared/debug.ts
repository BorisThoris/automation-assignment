import type { BrowserContext, Page } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { maskSensitiveText, timestampForFile } from "./utils.js";

export function debugOutputDir(outputDir = "results"): string {
  return path.join(outputDir, "debug");
}

export async function saveDebugPage(page: Page, prefix: string, outputDir = debugOutputDir()): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true }).catch(() => undefined);
  const timestamp = timestampForFile();
  await page.screenshot({ path: path.resolve(outputDir, `${prefix}-${timestamp}.png`), fullPage: true }).catch(() => undefined);
  const body = await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
  await fs.writeFile(path.resolve(outputDir, `${prefix}-${timestamp}.txt`), maskSensitiveText(body)).catch(() => undefined);
}

export async function saveContextDebug(context: BrowserContext, outputDir: string, prefix: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true }).catch(() => undefined);
  const timestamp = timestampForFile();

  for (const [index, page] of context.pages().entries()) {
    if (page.isClosed()) continue;
    const safePrefix = `${prefix}-${timestamp}-page-${index}`;
    await page.screenshot({ path: path.join(outputDir, `${safePrefix}.png`), fullPage: true }).catch(() => undefined);
    const text = await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
    await fs.writeFile(path.join(outputDir, `${safePrefix}.txt`), maskSensitiveText(text)).catch(() => undefined);
    await fs.writeFile(path.join(outputDir, `${safePrefix}.html`), maskSensitiveText(await page.content().catch(() => ""))).catch(() => undefined);

    const actions = await page.locator('button, [role="button"], a, input, textarea, [contenteditable="true"]').evaluateAll((elements) => elements.map((element, index) => {
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      return {
        index,
        tag: element.tagName,
        role: element.getAttribute("role"),
        type: element.getAttribute("type"),
        text: (htmlElement.innerText || htmlElement.textContent || "").trim(),
        aria: element.getAttribute("aria-label"),
        visible: rect.width > 0 && rect.height > 0,
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
      };
    })).catch(() => []);
    await fs.writeFile(path.join(outputDir, `${safePrefix}.actions.json`), `${JSON.stringify(actions, null, 2)}\n`).catch(() => undefined);
  }
}
