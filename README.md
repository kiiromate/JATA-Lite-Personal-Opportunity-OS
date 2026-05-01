# JATA Lite: Personal Opportunity OS

Local-first CLI for capturing, scoring, preparing, and tracking high-quality opportunities. The goal is better judgment and faster preparation, not mass application.

## First Local Test

From a clean checkout, run:

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm run build
pnpm smoke
```

`pnpm smoke` runs a fictional GreenGrid Labs opportunity through the full local workflow without manual typing. It writes resettable test data under `.local/smoke/`, including:

- `.local/smoke/outputs/daily-brief.md`
- `.local/smoke/outputs/opportunity-tracker.csv`
- `.local/smoke/outputs/<date>-greengrid-labs-operations-implementation-associate/`

Inspect the daily brief first, then the generated application pack, then the tracker CSV. To delete the smoke-test data, remove `.local/smoke/` or run `pnpm smoke` again to reset it safely.

Generated outputs and local opportunity data are ignored by git. Nothing is submitted, sent, scraped, scheduled, or uploaded automatically.

## What It Does

- Captures opportunity details into `data/opportunities.json`.
- Scores unscored opportunities with deterministic local logic.
- Generates reviewable Markdown application packs under `outputs/`.
- Produces a daily opportunity brief.
- Exports a CSV tracker.
- Keeps AI behind a provider interface, with mocked AI by default.

## What It Does Not Do

- Does not submit applications.
- Does not scrape behind logins.
- Does not fabricate experience, credentials, or work history.
- Does not require paid APIs or real API keys.
- Does not bypass ATS systems or automate deceptive behavior.

## Setup

```bash
pnpm install
```

The tool uses simple JSON file storage and runs locally. No database server is required.
The starter `data/opportunities.json` is a local working file and is ignored by git because it can contain contacts, notes, and private workflow state.

## Commands

```bash
pnpm start add
pnpm start score
pnpm start generate <opportunityId>
pnpm start brief
pnpm start export
pnpm smoke
pnpm test
pnpm typecheck
```

### `pnpm start add`

Prompts for role title, company, URL, source, full job description, deadline, contact, application method, and notes. The full job description prompt accepts multiple lines and ends when you enter `END` on its own line.

For local automation or CI verification, the same command can read `JATA_ADD_JSON` with the same fields. This does not submit anything and is only a capture shortcut.

### `pnpm start score`

Scores all opportunities that do not already have a score. Scoring is deterministic and does not use AI.

### `pnpm start generate <opportunityId>`

Creates a review-only application pack:

- `01-fit-analysis.md`
- `02-resume-tailoring-notes.md`
- `03-cover-email-draft.md`
- `04-referral-message.md`
- `05-application-checklist.md`

Every generated file includes a human review gate and claims-to-verify section.

### `pnpm start brief`

Writes `outputs/daily-brief.md` with top pursue opportunities, overdue follow-ups, applications waiting for review, recommended next actions, and a focused 20-minute workflow.

### `pnpm start export`

Writes `outputs/opportunity-tracker.csv`.

### `pnpm smoke`

Resets `.local/smoke/`, loads the fictional fixture from `fixtures/sample-opportunity.json`, scores it, generates a review-only application pack, writes a daily brief, exports a tracker CSV, and prints the generated paths. It forces mock/no-AI mode and does not require API keys.

## Data Model

`data/profile.json` stores Kaze's positioning, strengths, target lanes, constraints, and languages.

`data/opportunities.json` stores captured opportunities with:

- identity and timestamps
- company, role, source, URL, job description, deadline, contact, method, notes
- status and next action
- optional score
- optional generated pack path

## Privacy Model

- Outputs are ignored by git because application drafts can contain sensitive personal data.
- `data/opportunities.json` is ignored by git because it can contain local opportunity notes and contact details.
- `.env` files are ignored by git.
- The default provider is `MockProvider`, so no external AI service is called.
- `src/security/piiRedactor.ts` redacts emails, phone numbers, and long ID-like numbers before any AI provider call.
- AI prompts receive only the profile plus minimal opportunity context needed for drafting: company, role, and job description. Local notes, contacts, URLs, status, scores, and generated paths are not sent to providers.
- Real provider classes are skeletons for future extension and are not required for MVP v0.1.

## Daily 20-Minute Workflow

1. Run `pnpm start brief`.
2. Open `outputs/daily-brief.md`.
3. Follow the `20-Minute Workflow` section.
4. Stop after updating the next action, unless Kaze explicitly chooses to continue.

## Human Approval Workflow

JATA Lite is a decision and preparation system. It never submits anything automatically. Generated application artifacts are drafts only. Kaze must manually review, verify claims, approve the resume/message, and submit through the chosen channel.

## Roadmap

See `docs/ROADMAP.md`.
