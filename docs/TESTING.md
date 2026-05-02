# Testing

JATA Lite is tested as a local-first CLI. Tests should not require API keys, external AI providers, scraping, email sending, or application submission.

## Unit Tests

Run:

```bash
pnpm test
```

The suite covers validation, bulk import, duplicate handling, scoring, priority bands, shortlist ranking, batch pack generation, pipeline tracking, PII redaction, daily brief generation, CSV export, AI provider selection, application pack generation, and the smoke workflow.

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

The smoke test resets `.local/smoke/`, imports `fixtures/bulk-opportunities.csv`, scores all valid opportunities, writes shortlist Markdown and CSV, batch-generates the top two application packs, writes the daily brief, exports the tracker CSV, and prints output paths. It forces mock/no-AI mode and does not require secrets.

## Manual CLI Test

Run the commands manually when testing real local data:

```bash
pnpm start add
pnpm start import fixtures/bulk-opportunities.csv
pnpm start score --all
pnpm start shortlist --top 5
pnpm start generate-batch --top 2
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

Open `outputs/daily-brief.md`, review the `20-Minute Workflow`, then inspect `outputs/shortlist.md` and `outputs/opportunity-tracker.csv` if tracker data is needed.

## Known Limitations

- The CLI uses local JSON storage, not a database.
- Application packs are drafts and require human review before use.
- Real AI providers are skeletons and are not used by CLI pack generation or the smoke test.
- GitHub Actions artifacts may contain opportunity data if real data is present in the runner.
