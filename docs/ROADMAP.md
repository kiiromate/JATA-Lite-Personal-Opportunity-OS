# Roadmap

## v0.1 Local Single-Opportunity Workflow

- Capture opportunities locally.
- Score with deterministic rules.
- Clean pasted job descriptions.
- Generate review-only application packs.
- Export tracker CSV.
- Produce a daily brief manually.

Status: shipped.

## v0.3 Bulk Opportunity Triage

- Import CSV and JSON opportunity batches.
- Validate every row before saving.
- Skip invalid and duplicate rows with clear reporting.
- Score many opportunities at once.
- Add priority bands, effort estimates, application risk, and recommended action.
- Generate ranked shortlist Markdown and CSV.
- Batch-generate packs for selected or top opportunities.
- Track local pipeline status, next actions, manual application, and follow-up dates.
- Improve daily brief for pipeline management.
- Improve tracker CSV fields.

Status: current.

## Later Options

These are intentionally out of scope for v0.3:

- Google Sheets export or sync.
- Dashboard UI.
- Browser extension.
- Better profile management.
- Additional import templates.

Any later integration must preserve local-first storage, ignored generated outputs, and human approval before outreach or submission.

## Explicit Non-Goals

- No auto-apply.
- No email sending.
- No scraping.
- No LinkedIn automation.
- No n8n workflow in this version.
- No third-party AI requirement.
- No generated/private output commits.
