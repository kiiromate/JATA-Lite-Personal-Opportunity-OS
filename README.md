# JATA Lite: Personal Opportunity OS

Local-first opportunity operator system for capturing, bulk-scoring, prioritizing, preparing, and tracking opportunities. The goal is faster judgment and better follow-through, not mass application.

JATA Lite never submits applications, sends email, scrapes sites, automates LinkedIn, or requires API keys for the core workflow.

## Operator Console

v0.4 adds a local web console over the existing CLI/core modules. Use it when Kaze needs to import, score, shortlist, generate packs, inspect packs, update pipeline state, register resume versions, and create final application kit folders without typing every command.

```bash
pnpm install
pnpm start:api
pnpm start:web
```

Open the Vite URL printed by `pnpm start:web`, usually `http://127.0.0.1:5173`.

For a single built local app:

```bash
pnpm app
```

`pnpm app` builds the server and web console, then serves the built console from the local API server at `http://127.0.0.1:4317`.

Console views:

- Dashboard: totals, A/B/C/D counts, urgent deadlines, review-ready packs, follow-ups, and recommended actions.
- Import: drag/drop or paste CSV/JSON, dry-run validation, commit valid rows.
- Opportunities: filter, search, bulk select, score selected, generate selected packs.
- Shortlist: ranked bands, top/band batch generation, and items not worth touching today.
- Pack Viewer: read generated pack files in tabs, copy sections, save manual review notes.
- Pipeline: status updates, next actions, and follow-up dates.
- Resume Library: manually register local resume versions without parsing or uploading files.
- Kit Builder: create a final local application kit folder with copy-ready fields and claims to verify.
- Settings: mock/local mode, feature flags, connector readiness, and cost limits.

## First Local Test

From a clean checkout, run:

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm run build
pnpm smoke
```

`pnpm smoke` runs the fictional bulk fixture through import, scoring, shortlist generation, batch pack generation, daily brief, and CSV export. It writes resettable test data under `.local/smoke/`, including:

- `.local/smoke/outputs/shortlist.md`
- `.local/smoke/outputs/shortlist.csv`
- `.local/smoke/outputs/daily-brief.md`
- `.local/smoke/outputs/opportunity-tracker.csv`
- `.local/smoke/outputs/<date>-<company>-<role>/`

Generated outputs and local opportunity data are ignored by git. Nothing is submitted, sent, scraped, scheduled, or uploaded automatically.

## What It Does

- Imports many opportunities from CSV or JSON.
- Validates rows, skips invalid rows, and reports why.
- Deduplicates imported opportunities by company, role, URL, or normalized description.
- Scores opportunities deterministically with local rules and evidence analysis.
- Assigns `priorityBand`, `effortEstimate`, `applicationRiskLevel`, and `recommendedAction`.
- Generates ranked shortlists as Markdown and CSV.
- Batch-generates review-only application packs for selected or top opportunities.
- Serves a local operator console and JSON API for the same workflows.
- Tracks local pipeline status, next action, applied timestamp, and follow-up date.
- Produces a daily brief for pipeline management.
- Exports an improved tracker CSV.
- Registers local resume versions and creates final application kit folders.
- Provides disabled-by-default n8n, Google Drive, Google Sheets, external AI, and browser-assistant foundations.

## What It Does Not Do

- Does not auto-apply.
- Does not submit applications.
- Does not send email.
- Does not scrape sites or automate LinkedIn.
- Does not call external AI providers from the CLI workflows.
- Does not call external AI providers from the web console by default.
- Does not require paid APIs or real API keys.
- Does not fabricate experience, credentials, or work history.

## Setup

```bash
pnpm install
```

The tool uses local JSON file storage. No database server is required.

`data/opportunities.json` is a local working file and is ignored by git because it can contain contacts, notes, and private workflow state.

## Commands

```bash
pnpm start add
pnpm dev
pnpm start:api
pnpm start:web
pnpm app
pnpm start import <filePath> [--update]
pnpm start clean-jd <opportunityId>
pnpm start score [--all] [--status new] [--limit 25]
pnpm start shortlist [--top 10] [--band A] [--max-risk medium]
pnpm start generate <opportunityId>
pnpm start generate-batch [--top 5] [--band A] [--ids id1,id2]
pnpm start status <opportunityId> <status>
pnpm start next <opportunityId> "next action text"
pnpm start applied <opportunityId>
pnpm start followup <opportunityId> <YYYY-MM-DD>
pnpm start ignore <opportunityId>
pnpm start brief
pnpm start export
pnpm smoke
```

## Local API

The console uses a local API server launched with `pnpm start:api`.

Core endpoints include:

- `GET /api/health`
- `GET /api/opportunities`
- `POST /api/import/preview`
- `POST /api/import/commit`
- `POST /api/score/bulk`
- `POST /api/shortlist`
- `POST /api/generate-batch`
- `GET /api/packs/:id`
- `POST /api/application-kit/:id`
- `POST /api/ingest/opportunity`

The API reads and writes the same local JSON data as the CLI. It logs local actions under `.local/action-log.jsonl`.

### Bulk Import

CSV:

```bash
pnpm start import fixtures/bulk-opportunities.csv
```

JSON:

```bash
pnpm start import path/to/opportunities.json
```

Required fields:

- `company`
- `role`
- `description`

Optional fields:

- `url`
- `source`
- `deadline`
- `method`
- `contact`
- `notes`
- `salary`
- `location`
- `remote`

Invalid rows are skipped and reported. Duplicate rows are skipped unless `--update` is passed.

### Bulk Scoring

```bash
pnpm start score --all
pnpm start score --status new
pnpm start score --limit 25
```

Scoring is local and deterministic. It reuses the existing scorer and `analyzeEvidence()` so shortlist decisions and application packs share the same evidence basis.

Priority bands:

- `A`: strong pursue, high strategic fit and manageable risk.
- `B`: worth review, good fit with gaps or effort.
- `C`: maybe later, weak fit, high effort, or unclear value.
- `D`: ignore, low fit or high mismatch.

### Shortlist

```bash
pnpm start shortlist
pnpm start shortlist --top 10
pnpm start shortlist --band A
pnpm start shortlist --max-risk medium
```

Outputs:

- `outputs/shortlist.md`
- `outputs/shortlist.csv`

The shortlist ranks by priority band, score, deadline urgency, strategic fit, and effort. It separates A, B, C, and D opportunities and gives the next action for each row.

### Batch Pack Generation

```bash
pnpm start generate-batch --top 5
pnpm start generate-batch --band A
pnpm start generate-batch --ids id1,id2,id3
```

Default batch size is 5. D-band opportunities are not generated by default. A D-band opportunity is generated only when explicitly selected by ID.

Generated packs are review-only Markdown files under `outputs/`. Every pack keeps the human review gate and claims-to-verify sections.

### Pipeline Tracking

```bash
pnpm start status <opportunityId> <status>
pnpm start next <opportunityId> "next action text"
pnpm start applied <opportunityId>
pnpm start followup <opportunityId> <YYYY-MM-DD>
pnpm start ignore <opportunityId>
```

Supported pipeline statuses:

- `new`
- `scored`
- `shortlisted`
- `pack_generated`
- `review_ready`
- `applied`
- `follow_up_due`
- `interview`
- `rejected`
- `closed`
- `ignored`

`applied` means Kaze manually applied outside the tool. JATA Lite only records that state locally.

### Daily Brief

```bash
pnpm start brief
```

Writes `outputs/daily-brief.md` with:

- today's top 5 opportunities
- urgent deadlines
- review-ready packs
- follow-ups due
- stale opportunities with no action for 7+ days
- the 20-Minute Workflow
- low-priority opportunities to avoid today

### Export

```bash
pnpm start export
```

Writes `outputs/opportunity-tracker.csv` with scoring, priority, risk, effort, recommendation, applied, follow-up, last-updated, and pack-path fields.

## Data Model

`data/profile.json` stores Kaze's positioning, strengths, target lanes, constraints, and languages.

`data/opportunities.json` stores local opportunities with:

- identity and timestamps
- company, role, source, URL, job description, deadline, contact, method, notes
- optional salary, location, and remote fields
- pipeline status and next action
- score, priority band, effort estimate, risk level, and recommended action
- generated pack path
- applied and follow-up timestamps
- preferred local resume version reference

## Privacy Model

- Outputs are ignored by git because application drafts can contain sensitive personal data.
- `data/opportunities.json` is ignored by git because it can contain local opportunity notes and contact details.
- `.env` files are ignored by git.
- CLI application-pack generation uses mock/no-AI mode.
- The operator console defaults to `mock` provider mode and disabled connectors.
- `.local/` stores operator settings, action logs, resume metadata, and review notes. It is ignored by git.
- `src/security/piiRedactor.ts` redacts emails, phone numbers, and long ID-like numbers before any future provider call.
- Generated materials are drafts only and require human review before use.

## Human Approval Workflow

JATA Lite is a decision and preparation system. It never submits anything automatically. Kaze must manually review, verify claims, approve the resume/message, and submit through the chosen channel outside the tool.

## More Documentation

- `docs/BULK_TRIAGE.md`
- `docs/OPERATOR_CONSOLE.md`
- `docs/APPLICATION_ASSISTANT.md`
- `docs/N8N_BRIDGE.md`
- `docs/GOOGLE_CONNECTORS.md`
- `docs/TESTING.md`
- `docs/ROADMAP.md`
