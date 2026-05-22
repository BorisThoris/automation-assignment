# AccessOwl Browser Automation Challenge

TypeScript + Playwright automation for exporting members from a Notion workspace after signing in with Google.

## Quick Start

```sh
npm install
npx playwright install chromium
cp .env.sample .env
npm run verify
```

Fill `.env`:

```dotenv
GOOGLE_EMAIL=you@example.com
GOOGLE_PASSWORD=your-password
NOTION_WORKSPACE_URL=https://www.notion.so
USE_CDP_CHROME=true
CHROME_EXECUTABLE_PATH=/path/to/chrome
```

For the most reliable fully automated run, use a disposable Google account without interactive two-step verification. Phone prompts, SMS, and device confirmations require action outside the browser.

## Run

```sh
npm run export:members
```

For a fresh local browser/session run:

```sh
npm run export:members:clean
```

Outputs are regenerated on each run:

- `results/members.json`
- `results/members.png`

`results/` is git-ignored. Failed-run diagnostics go to `results/debug/`.

## Development Utilities

These are guarded helpers for retesting with disposable Notion data:

```sh
# Requires CONFIRM_DELETE_WORKSPACE=true
npm run notion:workspace:delete

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
- `GOOGLE_TOTP_SECRET` exists as best-effort support for in-browser code challenges, but the validated setup used no interactive second factor.
