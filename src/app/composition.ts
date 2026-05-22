import { FileSystemMemberArtifactWriter } from "../adapters/fileSystem/memberArtifactWriter.js";
import { PlaywrightNotionClient } from "../adapters/playwright/playwrightNotionClient.js";
import { runBrowserAutomation } from "./automationRuntime.js";
import { deleteNotionAccount } from "../useCases/deleteNotionAccount.js";
import { deleteNotionWorkspace } from "../useCases/deleteNotionWorkspace.js";
import { exportWorkspaceMembers } from "../useCases/exportWorkspaceMembers.js";

export function runExportWorkspaceMembers() {
  return runBrowserAutomation(async (runtime) => {
    const notionClient = new PlaywrightNotionClient(runtime);
    return exportWorkspaceMembers({
      authenticator: notionClient,
      sessionStateStore: notionClient,
      memberDirectory: notionClient,
      artifactWriter: new FileSystemMemberArtifactWriter(runtime.config)
    });
  });
}

export function runDeleteNotionWorkspace() {
  return runBrowserAutomation(async (runtime) => {
    const notionClient = new PlaywrightNotionClient(runtime);
    return deleteNotionWorkspace({
      authenticator: notionClient,
      workspaceLifecycle: notionClient
    });
  }, {
    validateConfig: (config) => {
      if (!config.confirmDeleteWorkspace) {
        throw new Error("Refusing to delete a Notion workspace without CONFIRM_DELETE_WORKSPACE=true.");
      }
    }
  });
}

export function runDeleteNotionAccount() {
  return runBrowserAutomation(async (runtime) => {
    const notionClient = new PlaywrightNotionClient(runtime);
    return deleteNotionAccount({
      authenticator: notionClient,
      accountLifecycle: notionClient
    });
  }, {
    validateConfig: (config) => {
      if (!config.confirmDeleteAccount) {
        throw new Error("Refusing to delete a Notion account without CONFIRM_DELETE_ACCOUNT=true.");
      }
    }
  });
}
