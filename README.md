# AccessOwl Browser Automation Challenge

TypeScript + Playwright automation for exporting members from a Notion workspace after signing in with Google.

## Findings

- Use a disposable Google account without interactive two-step verification for the most reliable fully automated run.
- Phone prompts, SMS, and device confirmations require action outside the browser. They could be automated with Android emulation, but that is much more complex than this challenge needs.
- `GOOGLE_TOTP_SECRET` exists as best-effort support for in-browser authenticator-code challenges, but that path was not fully validated.
- Notion workspace/account deletion can reset onboarding for retesting with the same Gmail account. Prefer workspace deletion; full account deletion is only for disposable test accounts.
- Results are stable files: `results/members.json` and `results/members.png`.

## Quick Start

```sh
npm install
npx playwright install chromium
cp .env.sample .env
npm run verify
```

Copy `.env.sample` to `.env`, then fill out the real values in `.env` before running the browser automation. At minimum, set:

```dotenv
GOOGLE_EMAIL=you@example.com
GOOGLE_PASSWORD=your-password
NOTION_WORKSPACE_URL=https://www.notion.so
USE_CDP_CHROME=true
CHROME_EXECUTABLE_PATH=/path/to/chrome
```

## Run

Export members from Notion using the current local browser/session state:

```sh
npm run export:members
```

Clear local Playwright/Chrome auth state, then run the full export flow from a fresh login:

```sh
npm run export:members:clean
```

Validate TypeScript and run unit tests without opening a browser:

```sh
npm run verify
```

Outputs are regenerated on each run:

- `results/members.json`
- `results/members.png`

`results/` is git-ignored. Failed-run diagnostics go to `results/debug/`.

## Development Utilities

These are guarded helpers for retesting with disposable Notion data:

Delete the current Notion workspace, which can force workspace onboarding again:

```sh
# Requires CONFIRM_DELETE_WORKSPACE=true
npm run notion:workspace:delete
```

Delete the Notion account associated with the configured Google login:

```sh
# Requires CONFIRM_DELETE_ACCOUNT=true
npm run notion:account:delete
```

Prefer workspace deletion for onboarding retests. Full account deletion is more destructive.

## Structure

```text
src/
  cli/          command entrypoints
  useCases/     business workflows and ports
  adapters/     Playwright and filesystem implementations
  domain/       pure member parsing logic
  app/          config, runtime, and composition
  browser/      browser startup
  shared/       common helpers and types
scripts/        local operational helpers
docs/           architecture and findings notes
```

More detail:

- `docs/ARCHITECTURE.md`
- `docs/FINDINGS.md`

## Notes

- Final JSON includes `name`, `email`, and `role`.
- `.env.sample` is committed; real `.env` is ignored.
