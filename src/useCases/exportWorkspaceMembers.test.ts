import { describe, expect, it, vi } from "vitest";
import { exportWorkspaceMembers } from "./exportWorkspaceMembers.js";

describe("exportWorkspaceMembers", () => {
  it("authenticates, exports members, writes artifacts, and captures the screenshot", async () => {
    const authenticator = {
      login: vi.fn().mockResolvedValue(undefined)
    };
    const sessionStateStore = {
      saveSession: vi.fn().mockResolvedValue(undefined)
    };
    const memberDirectory = {
      openMembersPage: vi.fn().mockResolvedValue(undefined),
      listMembers: vi.fn().mockResolvedValue([{ name: "Ada", email: "ada@example.com", role: "Owner" }]),
      captureScreenshot: vi.fn().mockResolvedValue(undefined)
    };
    const artifactWriter = {
      writeMembers: vi.fn().mockResolvedValue("results/members.json"),
      getScreenshotPath: vi.fn().mockReturnValue("results/members.png")
    };

    await expect(exportWorkspaceMembers({ authenticator, sessionStateStore, memberDirectory, artifactWriter })).resolves.toEqual({
      count: 1,
      membersPath: "results/members.json",
      screenshotPath: "results/members.png",
      members: [{ name: "Ada", email: "ada@example.com", role: "Owner" }]
    });

    expect(authenticator.login).toHaveBeenCalledBefore(sessionStateStore.saveSession);
    expect(memberDirectory.openMembersPage).toHaveBeenCalledOnce();
    expect(artifactWriter.writeMembers).toHaveBeenCalledWith([{ name: "Ada", email: "ada@example.com", role: "Owner" }]);
    expect(memberDirectory.captureScreenshot).toHaveBeenCalledWith("results/members.png");
  });
});
