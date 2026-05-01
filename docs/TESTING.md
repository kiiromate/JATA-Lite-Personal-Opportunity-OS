# Testing

JATA Lite is tested as a local-first CLI. Tests should not require API keys, external AI providers, scraping, email sending, or application submission.

## Unit Tests

Run:

```bash
pnpm test
```

The suite covers validation, scoring, PII redaction, daily brief generation, CSV export, AI provider selection, application pack generation, and the first-use smoke workflow.

## Typecheck

Run:

```bash
pnpm typecheck
```

This runs TypeScript with `--noEmit`.

## Build

Run:

```bash
pnpm run build
```

This compiles the TypeScript project into `dist/`.

## Smoke Test

Run:

```bash
pnpm smoke
```

The smoke test resets `.local/smoke/`, loads `fixtures/sample-opportunity.json`, scores the opportunity, generates an application pack, writes the daily brief, exports the tracker CSV, and prints output paths. It forces mock/no-AI mode and does not require secrets.

## Manual CLI Test

Run the commands manually when testing real local data:

```bash
pnpm start add
pnpm start score
pnpm start generate <opportunityId>
pnpm start brief
pnpm start export
```

Generated files are written to `outputs/`, and local opportunities are stored in `data/opportunities.json`. Both are ignored by git.

## GitHub Actions CI

CI runs on push and pull request:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

The daily brief workflow is manual-only through `workflow_dispatch`.

## Manual Daily Brief Workflow

For daily use:

```bash
pnpm start brief
pnpm start export
```

Open `outputs/daily-brief.md`, review the `20-Minute Workflow`, then inspect `outputs/opportunity-tracker.csv` if tracker data is needed.

## Known Limitations

- The CLI uses local JSON storage, not a database.
- Application packs are drafts and require human review before use.
- Real AI providers are skeletons and are not used by the smoke test.
- GitHub Actions artifacts may contain opportunity data if real data is present in the runner.
