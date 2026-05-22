import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const originalEnv = { ...process.env };

describe("loadConfig", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GOOGLE_EMAIL: "user@example.com",
      GOOGLE_PASSWORD: "password"
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("requires Google credentials", () => {
    delete process.env.GOOGLE_EMAIL;

    expect(() => loadConfig()).toThrow("Missing required environment variable: GOOGLE_EMAIL");
  });

  it("requires Chrome executable path when CDP mode is enabled", () => {
    process.env.USE_CDP_CHROME = "true";
    delete process.env.CHROME_EXECUTABLE_PATH;

    expect(() => loadConfig()).toThrow("CHROME_EXECUTABLE_PATH is required when USE_CDP_CHROME=true.");
  });

  it("rejects invalid CDP ports", () => {
    process.env.CDP_PORT = "70000";

    expect(() => loadConfig()).toThrow("CDP_PORT must be between 1 and 65535.");
  });

  it("rejects invalid Notion usage values", () => {
    process.env.NOTION_USAGE = "hobby";

    expect(() => loadConfig()).toThrow("NOTION_USAGE must be work, personal, or school.");
  });

  it("derives profile name and default output directory", () => {
    const config = loadConfig();

    expect(config.notionProfileName).toBe("User");
    expect(config.outputDir.endsWith("results")).toBe(true);
  });
});
