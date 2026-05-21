# AccessOwl Browser Automation Challenge

TypeScript + Playwright automation for exporting the member list from a Notion workspace after signing in with Google.

## Setup

```powershell
npm install
npx playwright install chromium
Copy-Item .env.example .env
```

Edit `.env`:

```dotenv
GOOGLE_EMAIL=you@example.com
GOOGLE_PASSWORD=your-password
GOOGLE_TOTP_SECRET=optional-base32-secret
NOTION_WORKSPACE_URL=https://www.notion.so
```

## Run

```powershell
npm run start
```

Outputs are written to `output/`:

- `members-<timestamp>.json`
- `members-<timestamp>.png` when `TAKE_SCREENSHOT=true`

The script stores a reusable Playwright session in `.auth/notion-state.json` after the first successful login. Delete `.auth/` to force a fresh Google sign-in.

## Environment Variables

| Name | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GOOGLE_EMAIL` | Yes | | Google account email |
| `GOOGLE_PASSWORD` | Yes | | Google account password |
| `GOOGLE_TOTP_SECRET` | No | | Base32 authenticator secret for TOTP challenges |
| `NOTION_WORKSPACE_URL` | No | `https://www.notion.so` | Workspace URL to open after login |
| `HEADLESS` | No | `false` | Set `true` for headless runs |
| `SLOW_MO_MS` | No | `75` | Playwright slow motion delay |
| `OUTPUT_DIR` | No | `output` | JSON and screenshot output folder |
| `TAKE_SCREENSHOT` | No | `true` | Save members page screenshot |
| `SESSION_STATE_PATH` | No | `.auth/notion-state.json` | Persisted login state |

## Notes / What I Learned

- Google login often introduces risk-based prompts that cannot be fully predicted. Running headed by default makes the automation resilient because the user can complete an unexpected prompt without changing code.
- Persisting Playwright storage state is important for reliability and developer ergonomics. It avoids repeatedly triggering Google's anti-abuse checks.
- Notion's UI labels and structure can change, so extraction is deliberately based on visible member rows containing emails, with role inference from nearby text.
- The most useful challenge output is deterministic JSON plus a full-page screenshot, because the screenshot gives quick evidence that the extracted data came from the expected page.
