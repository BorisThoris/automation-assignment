import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../../app/config.js";
import type { Member } from "../../shared/types.js";
import type { MemberArtifactWriter } from "../../useCases/ports.js";

export class FileSystemMemberArtifactWriter implements MemberArtifactWriter {
  constructor(private readonly config: AppConfig) {}

  async writeMembers(members: Member[]): Promise<string> {
    const membersPath = path.join(this.config.outputDir, "members.json");
    await fs.writeFile(membersPath, `${JSON.stringify(members, null, 2)}\n`);
    return membersPath;
  }

  getScreenshotPath(): string | undefined {
    return this.config.takeScreenshot
      ? path.join(this.config.outputDir, "members.png")
      : undefined;
  }
}
