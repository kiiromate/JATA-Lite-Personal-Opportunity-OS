# GitHub Actions

The repo includes two workflows:

- `CI`: runs on push and pull request.
- `Daily Brief`: runs only when manually triggered with `workflow_dispatch`.

## Daily Brief Workflow

The manual daily brief workflow installs dependencies, generates `outputs/daily-brief.md`, exports `outputs/opportunity-tracker.csv`, and uploads both files as a workflow artifact.

It does not run on a schedule. It does not require secrets. It does not call external AI providers, submit applications, send email, scrape websites, or automate LinkedIn.

## Privacy Warning

Uploaded artifacts may contain opportunity data from the workflow run, including company names, role details, notes, statuses, and generated review material. Do not use the artifact workflow with sensitive real opportunity data in a public repo.

For private or sensitive work, prefer the local CLI workflow and keep generated files under ignored local paths.
