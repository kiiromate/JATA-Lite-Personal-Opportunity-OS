# Roadmap

## Phase 1: Local CLI

- Capture opportunities locally.
- Score with deterministic rules.
- Generate review-only application packs.
- Export tracker CSV.
- Produce daily brief manually.

## Phase 2: GitHub Actions Daily Brief

- Keep manual `workflow_dispatch` first.
- Add optional scheduled brief only after privacy and artifact handling are reviewed.
- Avoid committing generated brief content unless intentionally approved.

## Phase 3: Google Sheets Sync

- Add a one-way export or sync adapter.
- Keep local JSON as the primary source until a stronger reason exists to move.
- Avoid storing secrets in repository files.

## Phase 4: Cloudflare Pages Dashboard

- Add a lightweight read-only dashboard for scanning opportunities.
- Keep local export/import simple.
- Do not require always-on local services.

## Phase 5: Optional n8n Integration

- Trigger brief generation or reminder workflows.
- Keep manual approval before outreach or submission.
- Log workflow runs and failures clearly.

## Phase 6: JATA Integration

- Reuse scoring, storage adapters, redaction, and provider abstractions.
- Add stronger profile management and reusable opportunity intelligence.
- Preserve human approval gates.
