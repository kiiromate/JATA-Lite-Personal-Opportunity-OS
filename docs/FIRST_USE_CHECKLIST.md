# First Use Checklist

Use this checklist for the first safe local run from a clean checkout.

## Local Setup

- [ ] Clone the repo.
- [ ] Run `pnpm install`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm run build`.
- [ ] Run `pnpm smoke`.

## Inspect Outputs

- [ ] Open `.local/smoke/outputs/daily-brief.md`.
- [ ] Open the generated application pack folder printed by `pnpm smoke`.
- [ ] Review `.local/smoke/outputs/opportunity-tracker.csv`.

## Safety Checks

- [ ] Confirm no API keys or secrets were required.
- [ ] Confirm no email, application, upload, or external submission happened.
- [ ] Confirm generated smoke outputs are ignored by git.

## Next Manual Step

- [ ] Add one real opportunity manually with `pnpm start add`.
