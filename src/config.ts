import "dotenv/config";
import path from "node:path";

export type AppConfig = {
  googleEmail: string;
  googlePassword: string;
  googleTotpSecret?: string;
  notionWorkspaceUrl: string;
  headless: boolean;
  slowMoMs: number;
  outputDir: string;
  takeScreenshot: boolean;
  sessionStatePath: string;
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
  return {
    googleEmail: required("GOOGLE_EMAIL"),
    googlePassword: required("GOOGLE_PASSWORD"),
    googleTotpSecret: process.env.GOOGLE_TOTP_SECRET?.trim() || undefined,
    notionWorkspaceUrl: process.env.NOTION_WORKSPACE_URL?.trim() || "https://www.notion.so",
    headless: booleanEnv("HEADLESS", false),
    slowMoMs: numberEnv("SLOW_MO_MS", 75),
    outputDir: path.resolve(process.env.OUTPUT_DIR?.trim() || "output"),
    takeScreenshot: booleanEnv("TAKE_SCREENSHOT", true),
    sessionStatePath: path.resolve(process.env.SESSION_STATE_PATH?.trim() || ".auth/notion-state.json")
  };
}
