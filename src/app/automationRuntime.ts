import fs from "node:fs/promises";
import path from "node:path";
import type { Browser, BrowserContext, Page } from "playwright";
import type { ChildProcess } from "node:child_process";
import { loadConfig, type AppConfig } from "./config.js";
import { startAutomationBrowser } from "../browser/automationBrowser.js";

export type AutomationRuntime = {
  config: AppConfig;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  launchedChrome?: ChildProcess;
};

export type BrowserAutomationOptions = {
  validateConfig?: (config: AppConfig) => void;
};

export async function runBrowserAutomation<TResult>(
  automation: (runtime: AutomationRuntime) => Promise<TResult>,
  options: BrowserAutomationOptions = {}
): Promise<TResult> {
  const config = loadConfig();
  options.validateConfig?.(config);
  await prepareRuntimeDirectories(config);

  const browserSession = await startAutomationBrowser(config);

  try {
    return await automation({
      config,
      browser: browserSession.browser,
      context: browserSession.context,
      page: browserSession.page,
      launchedChrome: browserSession.launchedChrome
    });
  } finally {
    await browserSession.browser.close();
    browserSession.launchedChrome?.kill();
  }
}

async function prepareRuntimeDirectories(config: AppConfig): Promise<void> {
  await fs.mkdir(config.outputDir, { recursive: true });
  await fs.mkdir(path.dirname(config.sessionStatePath), { recursive: true });
}
