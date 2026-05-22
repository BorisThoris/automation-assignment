# Architecture

This project is structured as a small automation service, not a single-purpose script. The goal is to make new browser workflows easy to add while keeping browser lifecycle, authentication, output writing, and destructive test helpers explicit.

## Layers

```text
src/
  cli/          Thin command entrypoints. Parse no business logic; print JSON results.
  useCases/     Business workflows and ports. No Playwright or filesystem details.
  adapters/     Playwright and filesystem implementations of use-case ports.
  domain/       Pure parsing and member extraction logic.
  app/          Runtime concerns: config loading and browser lifecycle.
  browser/      Playwright/Chrome startup details.
  shared/       Cross-cutting helpers, debug capture, selectors, and common types.
scripts/        Node-based operational helpers for development and repeatable clean runs.
docs/           Architecture and reviewer-facing project notes.
```

## Flow Boundaries

- `src/cli/*` files are intentionally tiny. They call one composed command and print a structured JSON result.
- `src/useCases/*` owns orchestration such as exporting workspace members or deleting a test account.
- `src/adapters/playwright/*` translates use-case ports into live Notion/Google browser actions.
- `src/domain/*` contains deterministic parsing that can be tested without Playwright.
- `src/app/composition.ts` wires use cases to adapters before browser startup.

## Adding Another Use Case

1. Add or reuse a port in `src/useCases/ports.ts`.
2. Compose the workflow in `src/useCases/<name>.ts`.
3. Add a tiny CLI wrapper in `src/cli/<name>.ts`.
4. Implement the port in `src/adapters/`.
5. Wire the use case in `src/app/composition.ts`.
6. Add an npm script that points to the CLI wrapper.
7. Keep destructive actions as separate, clearly named commands.

## Design Notes

- Outputs are JSON first so results are easy to pipe into another system.
- Challenge deliverables are written to stable files in `results/`; failed-run diagnostics are isolated under `results/debug/`.
- Member output contains only challenge-relevant fields: `name`, `email`, and `role`.
- The project keeps Node-based operational helpers in `scripts/` and TypeScript automation entrypoints in `src/cli/`.
- Risky reset flows are separate commands so the challenge export path remains focused and reviewable.
