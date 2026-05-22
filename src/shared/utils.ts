import fs from "node:fs/promises";

export function normalizeWhitespace(value: string): string {
  return value.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
}

export function timestampForFile(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function maskSensitiveText(value: string): string {
  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<EMAIL>");
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function fileExists(filePath: string): Promise<boolean> {
  return fs.access(filePath).then(() => true, () => false);
}

