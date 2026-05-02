# Operator Console

JATA Lite v0.4 adds a local web console over the existing TypeScript core. The CLI still works. The console reduces command-line busywork for high-volume opportunity triage.

## Run Locally

```bash
pnpm install
pnpm start:api
pnpm start:web
```

Open `http://127.0.0.1:5173`.

For the built local app:

```bash
pnpm app
```

This builds the server and web bundle, then serves the console from `http://127.0.0.1:4317`.

## What The Console Does

- Dashboard: shows the Operator Command Center, Today's Workflow, totals, A/B/C/D counts, urgent deadlines, review-ready packs, follow-ups due, recommended actions, and latest local actions.
- Import: previews CSV/JSON rows before saving, then commits only valid non-duplicate rows.
- Opportunities: searches, fast-filters, bulk selects, scores, batch-generates packs, builds selected kits when packs exist, and marks selected rows ignored.
- Shortlist: ranks opportunities and separates A/B/C/D bands from items not worth touching today.
- Pack Viewer: opens generated pack files in tabs, copies sections, saves manual review notes, persists keep/edit/remove/evidence-needed claim decisions, and shows unresolved evidence gaps before kit export.
- Pipeline: updates status, next action, and follow-up dates.
- Resume Library: registers local resume metadata and file paths without parsing or uploading resume files. Preferred/default resume selection is manual in v0.4.1.
- Kit Builder: creates a final application kit folder with copy-ready fields, selected resume reference, notes, claims to verify, and final submission checklist.
- Settings: shows provider mode, feature flags, connector readiness, and cost safety limits.

## Daily Operator Workflow

1. Open Dashboard and start from Today's Workflow.
2. Import or review new opportunities.
3. Score unscored opportunities from Dashboard or Opportunities.
4. Generate top A/B review packs.
5. Review pack claims and mark each important claim as keep, edit, remove, or evidence needed.
6. Build final application kits only after claims are visible.
7. Copy final fields from Kit Builder, attach the selected resume manually, and submit outside JATA Lite.
8. Return to Pipeline and mark the opportunity applied, follow-up due, ignored, or closed.

The console should answer what Kaze should do next without requiring routine CLI commands. The CLI remains supported for power use, smoke tests, and recovery.

## Fast Filters And Batch Actions

Opportunities includes fast filters for:

- apply today
- high fit
- low risk
- remote/global
- deadline soon
- packs to review
- kits ready
- follow-ups due
- stale
- not worth touching

Batch actions use the local API, not shell commands:

- score selected locally
- generate review packs
- build application kits for selected opportunities that already have packs
- mark selected opportunities ignored

## Local API

The console uses `src/server/operatorApi.ts` and `src/server/startApiServer.ts`.

Important endpoints:

- `GET /api/health`
- `GET /api/opportunities`
- `GET /api/opportunities/:id`
- `POST /api/import/preview`
- `POST /api/import/commit`
- `POST /api/opportunities/:id/score`
- `POST /api/score/bulk`
- `POST /api/shortlist`
- `POST /api/generate/:id`
- `POST /api/generate-batch`
- `POST /api/pipeline/status`
- `POST /api/pipeline/next`
- `POST /api/pipeline/followup`
- `GET /api/packs/:id`
- `POST /api/packs/:id/review-notes`
- `POST /api/application-kit/:id`
- `GET /api/daily-brief`
- `POST /api/export`
- `POST /api/ingest/opportunity`
- `GET /api/resumes`
- `POST /api/resumes`
- `GET /api/settings`
- `POST /api/settings`

## Local Storage

- `data/opportunities.json`: local working opportunity database, ignored by git.
- `outputs/`: generated packs, tracker CSVs, daily briefs, and application kits, ignored by git.
- `.local/action-log.jsonl`: local action log for imports, scoring, generation, status changes, and kit exports.
- `.local/resumes/library.json`: manually registered resume metadata.
- `.local/pack-review-notes.json`: pack review notes and claim decisions.
- `.local/operator-settings.json`: local console settings.

## Safety Model

The console does not submit applications, send emails, upload files, or call external AI by default. Automation foundations are visible through settings and feature flags, but risky actions remain disabled until explicitly configured and reviewed.
