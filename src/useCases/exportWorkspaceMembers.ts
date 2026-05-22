import type { Member } from "../shared/types.js";
import type { MemberArtifactWriter, NotionAuthenticator, NotionMemberDirectory, SessionStateStore } from "./ports.js";

export type ExportWorkspaceMembersDependencies = {
  authenticator: NotionAuthenticator;
  sessionStateStore: SessionStateStore;
  memberDirectory: NotionMemberDirectory;
  artifactWriter: MemberArtifactWriter;
};

export type ExportWorkspaceMembersResult = {
  count: number;
  membersPath: string;
  screenshotPath?: string;
  members: Member[];
};

export async function exportWorkspaceMembers({
  authenticator,
  sessionStateStore,
  memberDirectory,
  artifactWriter
}: ExportWorkspaceMembersDependencies): Promise<ExportWorkspaceMembersResult> {
  await authenticator.login();
  await sessionStateStore.saveSession();
  await memberDirectory.openMembersPage();

  const members = await memberDirectory.listMembers();
  const membersPath = await artifactWriter.writeMembers(members);
  const screenshotPath = artifactWriter.getScreenshotPath();

  if (screenshotPath) {
    await memberDirectory.captureScreenshot(screenshotPath);
  }

  return {
    count: members.length,
    membersPath,
    screenshotPath,
    members
  };
}
