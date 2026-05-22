import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { runExportWorkspaceMembers } from "../src/app/composition.js";

const repoRoot = path.resolve(import.meta.dirname, "..");
const cdpPort = Number(process.env.CDP_PORT || 9222);

await closeCdpBrowserIfRunning(cdpPort);
await removeLocalState();
await writeCleanRunMarker();

const result = await runExportWorkspaceMembers();
console.log(JSON.stringify(result, null, 2));

async function closeCdpBrowserIfRunning(port: number): Promise<void> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`);
    if (!response.ok) return;

    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    await browser.close();
  } catch {
    // No CDP browser is running, or it was already closed.
  }
}

async function removeLocalState(): Promise<void> {
  for (const relativePath of [".auth", ".chrome-profile"]) {
    await fs.rm(path.join(repoRoot, relativePath), { recursive: true, force: true });
  }
}

async function writeCleanRunMarker(): Promise<void> {
  const outputDir = path.join(repoRoot, "results", "debug");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, "clean-run-marker.txt"),
    `export-members-clean-start ${new Date().toISOString()}\n`
  );
}
