import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import type { AppConfig } from "../app/config.js";
import { fileExists } from "../shared/utils.js";

export type AutomationBrowser = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  launchedChrome?: ChildProcess;
};

export async function startAutomationBrowser(config: AppConfig): Promise<AutomationBrowser> {
  const launchedChrome = config.useCdpChrome ? await launchChromeForCdp(config) : undefined;
  const browser = config.useCdpChrome
    ? await chromium.connectOverCDP(`http://127.0.0.1:${config.cdpPort}`)
    : await chromium.launch({
      channel: config.browserChannel,
      headless: config.headless,
      slowMo: config.slowMoMs
    });

  const storageState = !config.useCdpChrome && await fileExists(config.sessionStatePath)
    ? config.sessionStatePath
    : undefined;
  const context = config.useCdpChrome
    ? browser.contexts()[0]
    : await browser.newContext({
      storageState,
      viewport: { width: 1440, height: 1000 }
    });

  return {
    browser,
    context,
    page: context.pages()[0] ?? await context.newPage(),
    launchedChrome
  };
}

async function launchChromeForCdp(config: AppConfig): Promise<ChildProcess> {
  if (!config.chromeExecutablePath) {
    throw new Error("CHROME_EXECUTABLE_PATH is required when USE_CDP_CHROME=true.");
  }

  await fs.mkdir(config.cdpUserDataDir, { recursive: true });

  const chrome = spawn(config.chromeExecutablePath, [
    `--remote-debugging-port=${config.cdpPort}`,
    `--user-data-dir=${config.cdpUserDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-popup-blocking",
    "about:blank"
  ], {
    detached: false,
    stdio: "ignore"
  });

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${config.cdpPort}/json/version`);
      if (response.ok) return chrome;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  chrome.kill();
  throw new Error(`Timed out waiting for Chrome CDP on port ${config.cdpPort}.`);
}
