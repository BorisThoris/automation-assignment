import type { Member } from "../shared/types.js";

export type NotionAuthenticator = {
  login(): Promise<void>;
};

export type SessionStateStore = {
  saveSession(): Promise<void>;
};

export type NotionMemberDirectory = {
  openMembersPage(): Promise<void>;
  listMembers(): Promise<Member[]>;
  captureScreenshot(path: string): Promise<void>;
};

export type MemberArtifactWriter = {
  writeMembers(members: Member[]): Promise<string>;
  getScreenshotPath(): string | undefined;
};

export type NotionWorkspaceLifecycle = {
  deleteWorkspace(): Promise<string>;
};

export type NotionAccountLifecycle = {
  deleteAccount(): Promise<string>;
};
