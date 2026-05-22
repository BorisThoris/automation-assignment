import type { BrowserContext, Page } from "playwright";
import { generateSync } from "otplib";
import type { AppConfig } from "../../../app/config.js";
import { GOOGLE_LOGIN_BUTTON } from "../../../shared/constants.js";
import { clickFirstVisible, clickFirstVisibleOptional, clickGoogleChallengeOption, fillIfVisible } from "../../../shared/controls.js";
import { debugOutputDir, saveContextDebug, saveDebugPage } from "../../../shared/debug.js";
import { isLoggedIntoNotion } from "../notion/notionDetection.js";
import { completeNotionOnboarding } from "../notion/notionOnboarding.js";
import { waitForNotionLanding, waitForNotionWorkspace } from "../notion/notionSession.js";

export async function loginToNotionWithGoogle(page: Page, context: BrowserContext, config: AppConfig): Promise<Page> {
  await page.goto(config.notionWorkspaceUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  if (await isLoggedIntoNotion(page)) return page;

  await page.goto("https://www.notion.so/login", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  if (await isLoggedIntoNotion(page)) return page;

  const googlePage = await clickGoogleLogin(page, context);
  await completeGoogleLogin(googlePage, config);
  await completeGoogleConsent(context, googlePage);
  const notionPage = await waitForNotionLanding(context, page, googlePage);
  await completeNotionOnboarding(notionPage, config);
  await waitForNotionWorkspace(context, notionPage, googlePage, config, config.outputDir);
  return context.pages().find((candidate) => !candidate.isClosed() && candidate.url().includes("notion.so")) ?? notionPage;
}

async function clickGoogleLogin(page: Page, context: BrowserContext): Promise<Page> {
  const locators = [
    page.getByRole("button", { name: GOOGLE_LOGIN_BUTTON }),
    page.getByRole("link", { name: GOOGLE_LOGIN_BUTTON }),
    page.locator('[role="button"]').filter({ hasText: GOOGLE_LOGIN_BUTTON }).first(),
    page.locator("button").filter({ hasText: GOOGLE_LOGIN_BUTTON }).first(),
    page.locator("text=/continue with google|sign in with google|google/i").first()
  ];

  const popupPromise = context.waitForEvent("page", { timeout: 5_000 }).catch(() => null);
  if (!await clickFirstVisibleOptional(locators, 30_000)) {
    await saveDebugPage(page, "google-login-button-timeout");
    throw new Error("Could not find Notion's Sign in with Google button.");
  }

  const popup = await popupPromise;
  const googlePage = popup ?? page;
  await googlePage.waitForLoadState("domcontentloaded").catch(() => undefined);
  return googlePage;
}

async function completeGoogleLogin(page: Page, config: AppConfig): Promise<void> {
  const emailInput = page.locator('input[type="email"], input[name="identifier"]').first();
  if (await emailInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await fillIfVisible(page, emailInput, config.googleEmail);
  } else if (await selectExistingGoogleProfile(page, config.googleEmail)) {
    await completeGoogleSecondFactor(page, config);
    return;
  } else {
    await fillIfVisible(page, emailInput, config.googleEmail);
  }

  await clickFirstVisible(page, [
    page.getByRole("button", { name: /^next$/i }),
    page.locator("#identifierNext button")
  ]);

  await ensureGooglePasswordStep(page, config.googleEmail);
  await fillIfVisible(page, page.locator('input[name="Passwd"], input[type="password"]:not([aria-hidden="true"])').first(), config.googlePassword);
  await clickFirstVisible(page, [
    page.getByRole("button", { name: /^next$/i }),
    page.locator("#passwordNext button")
  ]);

  await completeGoogleSecondFactor(page, config);
}

async function selectExistingGoogleProfile(page: Page, email: string): Promise<boolean> {
  const clicked = await page.evaluate((targetEmail) => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('div, button, [role="button"], [role="link"], li'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const text = (element.innerText || element.textContent || "").trim().toLowerCase();
        return rect.width > 0
          && rect.height > 0
          && text.includes(targetEmail.toLowerCase());
      });
    const target = candidates.at(-1);
    if (!target) return false;
    target.click();
    return true;
  }, email).catch(() => false);

  if (!clicked) return false;
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForTimeout(1_000);
  return true;
}

async function ensureGooglePasswordStep(page: Page, email: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const passwordVisible = await page.locator('input[name="Passwd"], input[type="password"]:not([aria-hidden="true"])').first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (passwordVisible) return;

    const emailInput = page.locator('input[type="email"], input[name="identifier"]').first();
    if (await emailInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await emailInput.fill(email);
      await clickFirstVisible(page, [
        page.getByRole("button", { name: /^next$/i }),
        page.locator("#identifierNext button")
      ]);
      continue;
    }

    await page.waitForTimeout(1_000);
  }
}

async function completeGoogleSecondFactor(page: Page, config: AppConfig): Promise<void> {
  const deadline = Date.now() + 75_000;

  while (Date.now() < deadline) {
    if (page.isClosed() || page.url().includes("notion.so")) return;

    const pageText = await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
    if (isGoogleConsentPage(page, pageText)) return;

    if (/this browser or app may not be secure/i.test(pageText) || /\/signin\/rejected/i.test(page.url())) {
      throw new Error("Google rejected this automated browser. Set USE_CDP_CHROME=true with a real Chrome executable, or use an account/session that Google accepts.");
    }

    const totpInput = page.locator([
      'input[name="totpPin"]:visible',
      'input[type="tel"]:visible',
      'input[autocomplete="one-time-code"]:visible',
      'input[aria-label*="code" i]:visible'
    ].join(", ")).first();

    if (await totpInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
      if (!config.googleTotpSecret) {
        throw new Error("Google is asking for a verification code, but GOOGLE_TOTP_SECRET is empty.");
      }
      await totpInput.fill(generateSync({ secret: config.googleTotpSecret }));
      await clickFirstVisible(page, [
        page.getByRole("button", { name: /^next$/i }),
        page.getByRole("button", { name: /verify|continue/i })
      ]);
      return;
    }

    if (config.googleTotpSecret) {
      const switchedChallenge = await clickGoogleChallengeOption(page, [
        /try another way/i,
        /more ways to sign in/i,
        /show more/i
      ]);
      const selectedTotp = await clickGoogleChallengeOption(page, [
        /authenticator/i,
        /google authenticator/i,
        /verification code/i,
        /get a verification code/i,
        /enter a code/i
      ]);

      if (switchedChallenge || selectedTotp) {
        await page.waitForTimeout(1_000);
        continue;
      }
    }

    if (/check your phone|tap yes|google prompt|open the gmail app|sent a notification|2-step verification/i.test(pageText)) {
      throw new Error("Google is requesting phone/app approval and no authenticator-code option was selectable.");
    }

    await page.waitForTimeout(1_000);
  }

  throw new Error("Timed out while handling Google verification. Use a test account without interactive 2FA, or retry with an in-browser verification method.");
}

async function completeGoogleConsent(context: BrowserContext, preferredPage: Page): Promise<void> {
  const deadline = Date.now() + 90_000;

  while (Date.now() < deadline) {
    const pages = [preferredPage, ...context.pages()].filter((page, index, all) => !page.isClosed() && all.indexOf(page) === index);
    const googlePages = pages.filter((page) => page.url().includes("accounts.google.com"));
    if (googlePages.length === 0) return;

    for (const page of googlePages) {
      const pageText = await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
      if (!isGoogleConsentPage(page, pageText)) continue;

      const clicked = await clickGoogleConsentButton(page);
      if (clicked) {
        await page.waitForLoadState("domcontentloaded").catch(() => undefined);
        if (page.isClosed()) return;
        await page.waitForTimeout(1_000).catch(() => undefined);
        if (page.isClosed()) return;
      }
    }

    const waitPage = pages.find((page) => !page.isClosed());
    if (!waitPage) return;
    await waitPage.waitForTimeout(1_000).catch(() => undefined);
  }

  await saveContextDebug(context, debugOutputDir(), "google-consent-timeout").catch(() => undefined);
  throw new Error("Timed out waiting for Google OAuth consent to complete.");
}

async function clickGoogleConsentButton(page: Page): Promise<boolean> {
  const clickedByDom = await page.evaluate(() => {
    const positive = ["continue", "next", "allow", "confirm", "\u043d\u0430\u043f\u0440\u0435\u0434"];
    const negative = ["cancel", "deny", "back", "\u043e\u0442\u043a\u0430\u0437"];
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"], a'))
      .map((element) => ({
        element,
        text: (element.innerText || element.textContent || element.getAttribute("aria-label") || "").trim().toLowerCase()
      }))
      .filter(({ element, text }) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0
          && rect.height > 0
          && style.visibility !== "hidden"
          && style.display !== "none"
          && positive.some((label) => text === label || text.includes(label))
          && !negative.some((label) => text === label || text.includes(label));
      });

    const target = candidates.at(-1)?.element;
    if (!target) return false;
    target.click();
    return true;
  }).catch(() => false);

  if (clickedByDom) return true;

  return clickGoogleChallengeOption(page, [
    /^continue$/i,
    /^next$/i,
    /^allow$/i,
    /^confirm$/i,
    /^\u043d\u0430\u043f\u0440\u0435\u0434$/i
  ]);
}

function isGoogleConsentPage(page: Page, pageText: string): boolean {
  return page.url().includes("accounts.google.com")
    && /notion/i.test(pageText)
    && /privacy policy|terms of service|account/i.test(pageText)
    && /continue|next|allow|\u043d\u0430\u043f\u0440\u0435\u0434/i.test(pageText);
}
