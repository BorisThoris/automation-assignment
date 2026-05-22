import "dotenv/config";
import path from "node:path";

export type AppConfig = {
  googleEmail: string;
  googlePassword: string;
  googleTotpSecret?: string;
  notionWorkspaceUrl: string;
  notionProfileName: string;
  notionUsage: "work" | "personal" | "school";
  headless: boolean;
  browserChannel?: "chrome" | "msedge";
  useCdpChrome: boolean;
  chromeExecutablePath?: string;
  cdpPort: number;
  cdpUserDataDir: string;
  slowMoMs: number;
  outputDir: string;
  takeScreenshot: boolean;
  sessionStatePath: string;
  notionWorkspaceDeleteName?: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "y"].includes(value);
}

function numberEnv(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number.`);
  }
  return parsed;
}

export function loadConfig(): AppConfig {
  const googleEmail = required("GOOGLE_EMAIL");
  const config: AppConfig = {
    googleEmail,
    googlePassword: required("GOOGLE_PASSWORD"),
    googleTotpSecret: process.env.GOOGLE_TOTP_SECRET?.replace(/\s+/g, "") || undefined,
    notionWorkspaceUrl: process.env.NOTION_WORKSPACE_URL?.trim() || "https://www.notion.so",
    notionProfileName: process.env.NOTION_PROFILE_NAME?.trim() || profileNameFromEmail(googleEmail),
    notionUsage: parseNotionUsage(process.env.NOTION_USAGE),
    headless: booleanEnv("HEADLESS", false),
    browserChannel: parseBrowserChannel(process.env.BROWSER_CHANNEL),
    useCdpChrome: booleanEnv("USE_CDP_CHROME", false),
    chromeExecutablePath: process.env.CHROME_EXECUTABLE_PATH?.trim() || undefined,
    cdpPort: numberEnv("CDP_PORT", 9222),
    cdpUserDataDir: path.resolve(process.env.CDP_USER_DATA_DIR?.trim() || ".chrome-profile"),
    slowMoMs: numberEnv("SLOW_MO_MS", 75),
    outputDir: path.resolve(process.env.OUTPUT_DIR?.trim() || "results"),
    takeScreenshot: booleanEnv("TAKE_SCREENSHOT", true),
    sessionStatePath: path.resolve(process.env.SESSION_STATE_PATH?.trim() || ".auth/notion-state.json"),
    notionWorkspaceDeleteName: process.env.NOTION_WORKSPACE_DELETE_NAME?.trim() || undefined
  };

  validateConfig(config);
  return config;
}

function validateConfig(config: AppConfig): void {
  if (config.useCdpChrome && !config.chromeExecutablePath) {
    throw new Error("CHROME_EXECUTABLE_PATH is required when USE_CDP_CHROME=true.");
  }

  if (config.cdpPort < 1 || config.cdpPort > 65535) {
    throw new Error("CDP_PORT must be between 1 and 65535.");
  }

  if (config.slowMoMs < 0) {
    throw new Error("SLOW_MO_MS must be zero or greater.");
  }
}

function parseNotionUsage(value: string | undefined): AppConfig["notionUsage"] {
  const usage = value?.trim().toLowerCase();
  if (!usage) return "work";
  if (usage === "work" || usage === "personal" || usage === "school") return usage;
  throw new Error("NOTION_USAGE must be work, personal, or school.");
}

function profileNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] || "Automation User";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Automation User";
}

function parseBrowserChannel(value: string | undefined): AppConfig["browserChannel"] {
  const channel = value?.trim().toLowerCase();
  if (!channel) return undefined;
  if (channel === "chrome" || channel === "msedge") return channel;
  throw new Error("BROWSER_CHANNEL must be either chrome or msedge when set.");
}
