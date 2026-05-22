# Findings

## Google Authentication

The most important reliability factor is the Google account security setup.

For a fully automated browser run, the Google account should avoid interactive second-factor methods such as:

- phone push approval
- "tap Yes" prompts
- SMS verification
- device confirmation prompts

Those flows require action outside the browser session. They could technically be automated with an Android emulator or a managed virtual device, but that adds a separate automation surface, more credentials/state to manage, and much more fragility than this challenge needs.

The tested and recommended path is:

- use a disposable test Google account without two-step verification.

TOTP is a theoretical alternate path because authenticator codes can be typed directly into the browser flow. The code includes support for `GOOGLE_TOTP_SECRET`, but this path was not fully validated in the final working setup. For this challenge, the simplest and most reliable setup is a test account with no interactive second factor.

## Notion Retesting

Notion onboarding only appears for a new or reset account/workspace. To retest the full account creation/onboarding path with the same Gmail account, the Notion account can be deleted and recreated by logging in again with Google.

The project includes guarded lifecycle commands for this:

```sh
npm run notion:workspace:delete
npm run notion:account:delete
```

Both commands require explicit confirmation flags in `.env` before they run:

```dotenv
CONFIRM_DELETE_WORKSPACE=true
CONFIRM_DELETE_ACCOUNT=true
```

For most retesting, deleting the workspace is enough to force the onboarding path again. Deleting the full Notion account is more destructive and should only be used with disposable test accounts.

## Output

The challenge deliverables are intentionally stable files:

- `results/members.json`
- `results/members.png`

Each successful run overwrites the previous result so the output folder stays clean. Debug captures from failed runs go under `results/debug/`.
