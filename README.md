# AccessOwl Browser Automation Challenge

TypeScript + Playwright automation for exporting the member list from a Notion workspace after signing in with Google.

## Setup

```sh
npm install
npx playwright install chromium
cp .env.sample .env
npm run verify
```

Edit `.env`:

```dotenv
GOOGLE_EMAIL=you@example.com
GOOGLE_PASSWORD=your-password
NOTION_WORKSPACE_URL=https://www.notion.so
USE_CDP_CHROME=true
CHROME_EXECUTABLE_PATH=/path/to/chrome
```

## Run

```sh
npm run export:members
```

For a fresh local browser/session run:

```sh
npm run export:members:clean
```

Validate the TypeScript build and unit tests:

```sh
npm run verify
```

Outputs are written to `results/`:

- `members.json`
- `members.png` when `TAKE_SCREENSHOT=true`

Each run overwrites the previous result files so the deliverable folder stays clean. Diagnostic screenshots and page dumps from failed runs are written under `results/debug/`.

`results/` is generated at runtime and intentionally git-ignored; reviewers can recreate the JSON and screenshot with `npm run export:members`.

The standard export stores a reusable Playwright session in `.auth/notion-state.json` after the first successful login. `export:members:clean` removes `.auth/` and `.chrome-profile/` before exporting, which forces a fresh local sign-in/onboarding path without deleting anything in Notion.

This project uses `.env.sample` as the committed environment template. The real `.env` file is intentionally ignored.

## Development Utilities

These commands are not required for the AccessOwl export. They are guarded helpers for retesting with disposable Notion data.

Delete the current Notion workspace to retest onboarding:

```sh
# Set CONFIRM_DELETE_WORKSPACE=true in .env first.
npm run notion:workspace:delete
```

Delete the Notion account for the configured Google email:

```sh
# Set CONFIRM_DELETE_ACCOUNT=true in .env first.
npm run notion:account:delete
```

Prefer workspace deletion for ordinary onboarding retests. Full account deletion is more destructive and should only be used with disposable test accounts.

## Project Structure

```text
src/
  cli/
    exportMembers.ts               # Member export CLI
    deleteWorkspace.ts             # Workspace reset CLI
    deleteAccount.ts               # Account deletion CLI
    runCli.ts                      # Shared CLI error handling / JSON output
  useCases/                        # Business workflows and their ports
  adapters/
    playwright/                    # Playwright-backed Notion implementation
    fileSystem/                    # Result artifact writer
  domain/                          # Pure parsing and member extraction logic
  app/config.ts                    # Environment loading and validation
  app/composition.ts               # Wires use cases to adapters
  app/automationRuntime.ts         # Browser lifecycle and runtime setup
  browser/automationBrowser.ts     # Playwright/Chrome startup
  shared/                         # Reusable selectors, click helpers, debug, types
scripts/
  exportMembersClean.ts            # Clears local state, then runs member export
docs/
  ARCHITECTURE.md                  # Design notes and extension guide
```

`src/cli/` contains TypeScript automation entrypoints that are part of the application. `scripts/` is reserved for local shell helpers that prepare or clean the environment before invoking those entrypoints.

For the full layering rationale and how to add more use cases, see `docs/ARCHITECTURE.md`.

For authentication and retesting notes discovered while building the automation, see `docs/FINDINGS.md`.

## Automated Google Verification

For the most reliable fully automated run, use a disposable Google account without interactive two-step verification. Phone prompts, SMS, and device confirmations require action outside the browser and are not part of the main tested path.

The code has best-effort support for authenticator-app codes through `GOOGLE_TOTP_SECRET`, but that path is documented as theoretical in `docs/FINDINGS.md` because the final validated setup used no interactive second factor.

## Environment Variables

| Name | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GOOGLE_EMAIL` | Yes | | Google account email |
| `GOOGLE_PASSWORD` | Yes | | Google account password |
| `GOOGLE_TOTP_SECRET` | No | | Best-effort base32 authenticator secret for in-browser code challenges |
| `NOTION_WORKSPACE_URL` | No | `https://www.notion.so` | Workspace URL to open after login |
| `HEADLESS` | No | `false` | Set `true` for headless runs |
| `BROWSER_CHANNEL` | No | `chrome` | Use installed Chrome or Edge. Helpful because Google may reject bundled Chromium. |
| `USE_CDP_CHROME` | No | `false` | Launch real Chrome and connect over CDP for Google login testing. |
| `CHROME_EXECUTABLE_PATH` | No | | Path to `chrome.exe` when `USE_CDP_CHROME=true`. |
| `CDP_PORT` | No | `9222` | Local Chrome DevTools port. |
| `CDP_USER_DATA_DIR` | No | `.chrome-profile` | Local Chrome profile directory for CDP mode. |
| `SLOW_MO_MS` | No | `75` | Playwright slow motion delay |
| `OUTPUT_DIR` | No | `results` | JSON and screenshot output folder |
| `TAKE_SCREENSHOT` | No | `true` | Save members page screenshot |
| `SESSION_STATE_PATH` | No | `.auth/notion-state.json` | Persisted login state |
| `CONFIRM_DELETE_WORKSPACE` | No | `false` | Required safety flag for deleting the current Notion workspace |
| `NOTION_WORKSPACE_DELETE_NAME` | No | | Exact workspace name to type in Notion's delete confirmation when inference fails |
| `CONFIRM_DELETE_ACCOUNT` | No | `false` | Required safety flag for deleting the Notion account itself |

## Notes / What I Learned

- Google login often introduces risk-based prompts that cannot be fully predicted. A disposable account without interactive two-step verification is the most reliable setup for this challenge.
- Persisting Playwright storage state is important for reliability and developer ergonomics. It avoids repeatedly triggering Google's anti-abuse checks.
- Launching real Chrome through CDP can avoid the "browser or app may not be secure" block that Google sometimes shows for bundled Chromium.
- Notion's UI labels and structure can change, so extraction is deliberately based on visible member rows containing emails, with role inference from nearby text.
- The most useful challenge output is deterministic JSON plus a full-page screenshot, because the screenshot gives quick evidence that the extracted data came from the expected page.
