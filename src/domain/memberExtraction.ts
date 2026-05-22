import type { Member } from "../shared/types.js";
import { normalizeWhitespace } from "../shared/utils.js";

export type MemberCandidate = Member & {
  rawText: string;
};

export function extractMembersFromTextSources(rowTexts: string[], pageText: string): Member[] {
  const candidates = [
    ...extractMembersFromRows(rowTexts),
    ...extractMembersFromPageText(pageText)
  ];

  return mergeMemberCandidates(candidates);
}

export function extractMembersFromRows(rowTexts: string[]): MemberCandidate[] {
  return rowTexts.flatMap((rowText) => {
    const rawText = normalizeWhitespace(rowText);
    const email = findEmail(rawText);
    if (!email) return [];

    const lines = rawText.split("\n").map(normalizeWhitespace).filter(Boolean);
    const emailIndex = lines.findIndex((line) => line.includes(email));
    const linesAfterEmail = emailIndex >= 0 ? lines.slice(emailIndex + 1, emailIndex + 10) : lines;
    const linesBeforeEmail = emailIndex >= 0 ? lines.slice(Math.max(0, emailIndex - 5), emailIndex).reverse() : lines;
    const role = inferRole(linesAfterEmail) ?? inferRole(lines);
    return [{
      name: inferName(linesBeforeEmail, email, role),
      email,
      role,
      rawText
    }];
  });
}

export function extractMembersFromPageText(pageText: string): MemberCandidate[] {
  const lines = pageText.split("\n").map(normalizeWhitespace).filter(Boolean);
  const members: MemberCandidate[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const email = findEmail(lines[index]);
    if (!email) continue;

    const previousLines = lines.slice(Math.max(0, index - 3), index).reverse();
    const nextLines = lines.slice(index + 1, index + 8);
    const role = inferRole(nextLines) ?? inferRole(previousLines);
    const name = previousLines.find((line) =>
      !line.includes("@")
      && !/^(user|teamspaces|groups|role|members \d+)$/i.test(line)
      && !inferRole([line])
    ) ?? null;
    const rawText = [...previousLines.reverse(), lines[index], ...nextLines].join("\n");
    members.push({ name, email, role, rawText });
  }

  return members;
}

export function mergeMemberCandidates(candidates: MemberCandidate[]): Member[] {
  const members = new Map<string, MemberCandidate>();

  for (const candidate of candidates) {
    const key = candidate.email.toLowerCase();
    const existing = members.get(key);
    members.set(key, {
      name: existing?.name ?? candidate.name,
      email: candidate.email,
      role: existing?.role ?? candidate.role,
      rawText: existing?.rawText && existing.rawText.length > candidate.rawText.length
        ? existing.rawText
        : candidate.rawText
    });
  }

  return [...members.values()]
    .map(({ name, email, role }) => ({ name, email, role }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export function inferRole(lines: string[]): string | null {
  const knownRoles = ["Workspace owner", "Owner", "Membership admin", "Admin", "Member", "Guest"];
  return knownRoles.find((role) => lines.some((line) => line.toLowerCase() === role.toLowerCase())) ?? null;
}

function inferName(lines: string[], email: string, role: string | null): string | null {
  return lines.find((line) =>
    line !== email
    && line !== role
    && !line.includes("@")
    && !/^(skip to content|groups|role|user|teamspaces|members \d+|no access|none|account|workspace|people|admin|member|workspace owner)$/i.test(line)
  ) ?? null;
}

function findEmail(value: string): string | null {
  return value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
}
