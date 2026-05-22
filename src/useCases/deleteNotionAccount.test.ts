import { describe, expect, it, vi } from "vitest";
import { deleteNotionAccount } from "./deleteNotionAccount.js";

describe("deleteNotionAccount", () => {
  it("logs in before deleting the account", async () => {
    const authenticator = {
      login: vi.fn().mockResolvedValue(undefined)
    };
    const accountLifecycle = {
      deleteWorkspace: vi.fn().mockResolvedValue("Workspace"),
      deleteAccount: vi.fn().mockResolvedValue("user@example.com")
    };

    await expect(deleteNotionAccount({ authenticator, accountLifecycle })).resolves.toEqual({
      deletedAccount: "user@example.com"
    });

    expect(authenticator.login).toHaveBeenCalledOnce();
    expect(accountLifecycle.deleteAccount).toHaveBeenCalledOnce();
  });
});
