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

Status: shipped.

## v0.4 Operator Console And Automation Foundation

- Add a local web operator console for dashboard, import, opportunity review, shortlist, pack viewer, pipeline, resume library, kit builder, and settings.
- Expose existing core functions through a local JSON API without breaking CLI commands.
- Add dry-run import preview and commit from the UI.
- Add bulk score, shortlist, batch generation, pack loading, pipeline updates, daily brief, and CSV export through the API.
- Add local action logs for imports, scoring, generation, status changes, review notes, resume registration, and kit exports.
- Add resume library metadata under `.local/resumes/`.
- Add application kit builder under `outputs/application-kits/`.
- Add n8n ingest endpoint foundation.
- Add Google Drive and Google Sheets disabled connector skeletons.
- Add external AI settings with mock mode as the default and cost safety limits.

Status: current.

## v0.4.1 Operator Usability And Reliability

- Add Dashboard Operator Command Center and Today's Workflow.
- Add fast opportunity filters and high-value batch actions.
- Improve pack review with persistent claim decisions and unresolved evidence gaps.
- Improve kit builder with visible selected resume reference, copy-ready final fields, claims to verify, output folder, and final checklist.
- Improve resume registration metadata without PDF parsing.
- Improve empty, loading, success, and error states in routine console paths.

Status: current hardening pass.

## v0.5 Semi-Automation Layer

- Add explicit approval controls around n8n webhook intake.
- Add Google Sheets export/sync behind feature flags and explicit operator approval.
- Add Google Drive export for selected kits and packs, never automatic sync by default.
- Improve resume-version selection with manually maintained lane defaults and no PDF parsing requirement.
- Add browser-assistant planning interface for copy/paste form support without final submit.
- Expand action log browsing, filtering, and rollback notes.
- Add more operator-level tests around UI workflows.

Status: planned.

## v0.6 Controlled Connector Layer

- Add optional connector setup wizards only after local workflow is stable.
- Add Drive/Sheets push actions that show destination, files, and privacy impact before transfer.
- Add n8n intake review queue with accept/reject controls and audit log entries.
- Add external AI provider use only through explicit settings, cost limits, and visible output metadata.
- Add browser-assistant copy support that requires Kaze to approve each field and never submits forms silently.

Status: planned after v0.5.

## Later Options

These are intentionally out of scope for v0.4/v0.4.1:

- Browser extension.
- Gmail draft API integration.
- Drive folder watchers.
- Automatic resume selection using embeddings.
- Playwright-based form filling.
- Hosted dashboard.
- Automatic application submission.

Any later integration must preserve local-first storage, ignored generated outputs, and human approval before outreach or submission.

## Explicit Non-Goals

- No auto-apply.
- No email sending.
- No scraping.
- No LinkedIn automation.
- No n8n workflow in this version.
- No third-party AI requirement.
- No generated/private output commits.
