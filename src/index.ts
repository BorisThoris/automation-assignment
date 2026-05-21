import { chromium, type BrowserContext, type Locator, type Page } from "playwright";
import { generateSync } from "otplib";
import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig, type AppConfig } from "./config.js";

type Member = {
  name: string | null;
  email: string | null;
  role: string | null;
  rawText: string;
};

const GOOGLE_LOGIN_BUTTON = /continue with google|sign in with google/i;
const SETTINGS_LABEL = /settings|settings & members/i;
const MEMBERS_LABEL = /members|people/i;

async function main(): Promise<void> {
  const config = loadConfig();
  await fs.mkdir(config.outputDir, { recursive: true });
  await fs.mkdir(path.dirname(config.sessionStatePath), { recursive: true });

  const storageState = await fileExists(config.sessionStatePath) ? config.sessionStatePath : undefined;
  const browser = await chromium.launch({
    headless: config.headless,
    slowMo: config.slowMoMs
  });

  const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 1000 }
  });

  const page = await context.newPage();

  try {
    await loginToNotionWithGoogle(page, context, config);
    await context.storageState({ path: config.sessionStatePath });

    await openMembersPage(page, config.notionWorkspaceUrl);
    const members = await extractMembers(page);

    const timestamp = timestampForFile();
    const membersPath = path.join(config.outputDir, `members-${timestamp}.json`);
    await fs.writeFile(membersPath, `${JSON.stringify(members, null, 2)}\n`);

    if (config.takeScreenshot) {
      await page.screenshot({
        path: path.join(config.outputDir, `members-${timestamp}.png`),
        fullPage: true
      });
    }

    console.log(JSON.stringify({ count: members.length, membersPath, members }, null, 2));
  } finally {
    await browser.close();
  }
}

async function loginToNotionWithGoogle(page: Page, context: BrowserContext, config: AppConfig): Promise<void> {
  await page.goto(config.notionWorkspaceUrl, { waitUntil: "domcontentloaded" });

  if (await isLoggedIntoNotion(page)) {
    return;
  }

  await page.goto("https://www.notion.so/login", { waitUntil: "domcontentloaded" });
  if (await isLoggedIntoNotion(page)) {
    return;
  }

  const googlePage = await clickGoogleLogin(page, context);
  await completeGoogleLogin(googlePage, config);
  await waitForNotionWorkspace(page, googlePage);
}

async function clickGoogleLogin(page: Page, context: BrowserContext): Promise<Page> {
  const button = page.getByRole("button", { name: GOOGLE_LOGIN_BUTTON }).first()
    .or(page.getByText(GOOGLE_LOGIN_BUTTON).first());

  await button.waitFor({ state: "visible", timeout: 30_000 });

  const popupPromise = context.waitForEvent("page", { timeout: 5_000 }).catch(() => null);
  await button.click();
  const popup = await popupPromise;
  const googlePage = popup ?? page;
  await googlePage.waitForLoadState("domcontentloaded").catch(() => undefined);
  return googlePage;
}

async function completeGoogleLogin(page: Page, config: AppConfig): Promise<void> {
  await fillIfVisible(page.locator('input[type="email"], input[name="identifier"]').first(), config.googleEmail);
  await clickFirstVisible(page, [
    page.getByRole("button", { name: /^next$/i }),
    page.locator("#identifierNext button")
  ]);

  await fillIfVisible(page.locator('input[type="password"], input[name="Passwd"]').first(), config.googlePassword);
  await clickFirstVisible(page, [
    page.getByRole("button", { name: /^next$/i }),
    page.locator("#passwordNext button")
  ]);

  if (config.googleTotpSecret) {
    const code = generateSync({ secret: config.googleTotpSecret });
    const totpInput = page.locator('input[type="tel"], input[name="totpPin"], input[aria-label*="code" i]').first();
    if (await totpInput.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await totpInput.fill(code);
      await clickFirstVisible(page, [page.getByRole("button", { name: /^next$/i })]);
    }
  }
}

async function waitForNotionWorkspace(originalPage: Page, authPage: Page): Promise<void> {
  const pages = Array.from(new Set([originalPage, authPage]));
  const deadline = Date.now() + 180_000;

  while (Date.now() < deadline) {
    for (const page of pages) {
      if (page.isClosed()) continue;
      if (page.url().includes("notion.so") && await isLoggedIntoNotion(page)) {
        if (page !== originalPage) {
          await originalPage.goto(page.url(), { waitUntil: "domcontentloaded" }).catch(() => undefined);
        }
        return;
      }
    }
    await originalPage.waitForTimeout(1_000);
  }

  throw new Error("Timed out waiting for Notion workspace. If Google prompts for extra verification, run with HEADLESS=false and finish the challenge manually.");
}

async function isLoggedIntoNotion(page: Page): Promise<boolean> {
  if (!page.url().includes("notion.so")) return false;
  const loginButtonVisible = await page.getByRole("button", { name: GOOGLE_LOGIN_BUTTON }).first()
    .isVisible({ timeout: 1_000 })
    .catch(() => false);
  if (loginButtonVisible) return false;

  const settingsVisible = await page.getByText(SETTINGS_LABEL).first()
    .isVisible({ timeout: 2_000 })
    .catch(() => false);
  return settingsVisible || !/\/login\b/.test(page.url());
}

async function openMembersPage(page: Page, workspaceUrl: string): Promise<void> {
  if (!page.url().includes("notion.so")) {
    await page.goto(workspaceUrl, { waitUntil: "domcontentloaded" });
  }

  await clickFirstVisible(page, [
    page.getByRole("button", { name: SETTINGS_LABEL }),
    page.getByText(SETTINGS_LABEL).first()
  ]);

  await clickFirstVisible(page, [
    page.getByRole("tab", { name: MEMBERS_LABEL }),
    page.getByRole("button", { name: MEMBERS_LABEL }),
    page.getByText(MEMBERS_LABEL).first()
  ]);

  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(1_000);
}

async function extractMembers(page: Page): Promise<Member[]> {
  const rows = page.locator('[role="row"], [data-testid*="member" i], div:has-text("@")');
  const count = await rows.count();
  const members = new Map<string, Member>();

  for (let index = 0; index < count; index += 1) {
    const rawText = normalizeWhitespace(await rows.nth(index).innerText().catch(() => ""));
    const email = rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
    if (!email) continue;

    const lines = rawText.split("\n").map(normalizeWhitespace).filter(Boolean);
    const role = inferRole(lines);
    const name = inferName(lines, email, role);
    members.set(email.toLowerCase(), { name, email, role, rawText });
  }

  return [...members.values()].sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
}

function inferRole(lines: string[]): string | null {
  const knownRoles = ["Workspace owner", "Owner", "Membership admin", "Admin", "Member", "Guest"];
  return lines.find((line) => knownRoles.some((role) => line.toLowerCase() === role.toLowerCase())) ?? null;
}

function inferName(lines: string[], email: string, role: string | null): string | null {
  return lines.find((line) => line !== email && line !== role && !line.includes("@")) ?? null;
}

async function fillIfVisible(locator: Locator, value: string): Promise<void> {
  await locator.waitFor({ state: "visible", timeout: 30_000 });
  await locator.fill(value);
}

async function clickFirstVisible(page: Page, locators: Locator[]): Promise<void> {
  for (const locator of locators) {
    if (await locator.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
      await locator.first().click();
      return;
    }
  }
  await page.screenshot({ path: path.resolve("output", `debug-${timestampForFile()}.png`), fullPage: true }).catch(() => undefined);
  throw new Error("Could not find an expected clickable control.");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
}

function timestampForFile(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function fileExists(filePath: string): Promise<boolean> {
  return fs.access(filePath).then(() => true, () => false);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
