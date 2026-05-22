import { describe, expect, it } from "vitest";
import { extractMembersFromPageText, extractMembersFromRows, extractMembersFromTextSources, inferRole } from "./memberExtraction.js";

describe("member extraction", () => {
  it("extracts member fields from row text", () => {
    const members = extractMembersFromRows([
      "Groups\nRole\nAda Lovelace\nada@example.com\nNo access\nNone\nWorkspace owner"
    ]);

    expect(members).toEqual([{
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "Workspace owner",
      rawText: "Groups\nRole\nAda Lovelace\nada@example.com\nNo access\nNone\nWorkspace owner"
    }]);
  });

  it("extracts member fields from full page text fallback", () => {
    const members = extractMembersFromPageText([
      "User",
      "Grace Hopper",
      "grace@example.com",
      "No access",
      "None",
      "Member"
    ].join("\n"));

    expect(members[0]).toMatchObject({
      name: "Grace Hopper",
      email: "grace@example.com",
      role: "Member"
    });
  });

  it("merges duplicates and returns clean public members without rawText", () => {
    const members = extractMembersFromTextSources([
      "Ada Lovelace\nada@example.com\nWorkspace owner"
    ], [
      "Ada Byron",
      "ada@example.com",
      "Member"
    ].join("\n"));

    expect(members).toEqual([{
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "Workspace owner"
    }]);
    expect(members[0]).not.toHaveProperty("rawText");
  });

  it("ignores page chrome around large text matches", () => {
    const members = extractMembersFromRows([
      [
        "Skip to content",
        "Admin",
        "Groups",
        "Role",
        "Katherine Johnson",
        "katherine@example.com",
        "No access",
        "None",
        "Workspace owner"
      ].join("\n")
    ]);

    expect(members[0]).toMatchObject({
      name: "Katherine Johnson",
      email: "katherine@example.com",
      role: "Workspace owner"
    });
  });

  it("infers known Notion roles", () => {
    expect(inferRole(["No access", "Membership admin"])).toBe("Membership admin");
    expect(inferRole(["No access", "Unknown"])).toBeNull();
  });
});
