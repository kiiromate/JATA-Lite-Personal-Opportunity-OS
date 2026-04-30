# Architecture

## Module Diagram

```text
CLI commands
  -> core/opportunity.ts
  -> storage/jsonStore.ts
  -> scoring/scorer.ts
  -> generators/applicationPack.ts
  -> generators/dailyBrief.ts
  -> generators/csvExporter.ts
  -> security/piiRedactor.ts
  -> generators/aiProvider.ts
```

## Storage Flow

```text
pnpm start add
  -> prompt user
  -> validate opportunity
  -> append to data/opportunities.json

pnpm start score
  -> read data/profile.json
  -> read data/opportunities.json
  -> score unscored records locally
  -> update data/opportunities.json

pnpm start generate <id>
  -> read profile and opportunity
  -> generate Markdown pack under outputs/YYYY-MM-DD-company-role/
  -> mark opportunity as review_ready

pnpm start brief/export
  -> read opportunities
  -> write outputs/daily-brief.md or outputs/opportunity-tracker.csv
```

## Privacy and Human Approval Gates

- `outputs/` is ignored by git because generated drafts can contain sensitive data.
- `.env` files are ignored by git.
- The CLI never submits an application.
- Generated packs include `Human Review Required` and `Claims to verify before sending`.
- Application status moves to `review_ready` after generation, not `applied`.
- AI mode is off by default.

## AI Provider Abstraction

```text
AIProvider.generate(prompt: string): Promise<string>
  -> MockProvider
  -> OpenRouterProvider skeleton
  -> GeminiProvider skeleton
```

The MVP uses `MockProvider` by default and does not require keys. If AI mode is enabled later, text should pass through `redactBeforeAI()` before provider calls, and generated files must include an AI mode warning.
