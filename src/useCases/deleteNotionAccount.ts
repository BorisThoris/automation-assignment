import type { NotionAccountLifecycle, NotionAuthenticator } from "./ports.js";

export type DeleteNotionAccountDependencies = {
  authenticator: NotionAuthenticator;
  accountLifecycle: NotionAccountLifecycle;
};

export type DeleteNotionAccountResult = {
  deletedAccount: string;
};

export async function deleteNotionAccount({
  authenticator,
  accountLifecycle
}: DeleteNotionAccountDependencies): Promise<DeleteNotionAccountResult> {
  await authenticator.login();
  return {
    deletedAccount: await accountLifecycle.deleteAccount()
  };
}
