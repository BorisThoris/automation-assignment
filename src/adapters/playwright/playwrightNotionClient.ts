import type { Page } from "playwright";
import type { AutomationRuntime } from "../../app/automationRuntime.js";
import { loginToNotionWithGoogle } from "./google/googleAuth.js";
import { deleteCurrentNotionAccount } from "./notion/notionAccountDeletion.js";
import { extractMembers, openMembersPage } from "./notion/notionMembersPage.js";
import { deleteCurrentNotionWorkspace } from "./notion/notionWorkspaceDeletion.js";
import type { Member } from "../../shared/types.js";
import type { NotionAccountLifecycle, NotionAuthenticator, NotionMemberDirectory, NotionWorkspaceLifecycle, SessionStateStore } from "../../useCases/ports.js";

export class PlaywrightNotionClient implements NotionAuthenticator, SessionStateStore, NotionMemberDirectory, NotionWorkspaceLifecycle, NotionAccountLifecycle {
  private notionPage?: Page;

  constructor(private readonly runtime: AutomationRuntime) {}

  async login(): Promise<void> {
    this.notionPage = await loginToNotionWithGoogle(this.runtime.page, this.runtime.context, this.runtime.config);
  }

  async saveSession(): Promise<void> {
    await this.runtime.context.storageState({ path: this.runtime.config.sessionStatePath });
  }

  async openMembersPage(): Promise<void> {
    await openMembersPage(this.getNotionPage(), this.runtime.config.notionWorkspaceUrl);
  }

  async listMembers(): Promise<Member[]> {
    return extractMembers(this.getNotionPage());
  }

  async captureScreenshot(path: string): Promise<void> {
    await this.getNotionPage().screenshot({ path, fullPage: true });
  }

  async deleteWorkspace(): Promise<string> {
    const result = await deleteCurrentNotionWorkspace(this.getNotionPage(), this.runtime.config.notionWorkspaceDeleteName);
    return result.workspaceName;
  }

  async deleteAccount(): Promise<string> {
    const result = await deleteCurrentNotionAccount(
      this.getNotionPage(),
      this.runtime.config.googleEmail,
      this.runtime.config.notionProfileName
    );
    return result.email;
  }

  private getNotionPage(): Page {
    if (!this.notionPage) {
      throw new Error("Notion session has not been authenticated.");
    }
    return this.notionPage;
  }
}
