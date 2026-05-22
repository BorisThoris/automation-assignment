import type { NotionAuthenticator, NotionWorkspaceLifecycle } from "./ports.js";

export type DeleteNotionWorkspaceDependencies = {
  authenticator: NotionAuthenticator;
  workspaceLifecycle: NotionWorkspaceLifecycle;
};

export type DeleteNotionWorkspaceResult = {
  deletedWorkspace: string;
};

export async function deleteNotionWorkspace({
  authenticator,
  workspaceLifecycle
}: DeleteNotionWorkspaceDependencies): Promise<DeleteNotionWorkspaceResult> {
  await authenticator.login();
  return {
    deletedWorkspace: await workspaceLifecycle.deleteWorkspace()
  };
}
