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

Local web console
  -> web/src/App.tsx
  -> src/server/operatorApi.ts
  -> same core/storage/scoring/generator modules as CLI
  -> .local/ action logs, settings, resume metadata, review notes
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

pnpm start:api
  -> start local HTTP API
  -> serve /api/* JSON routes
  -> serve built web console from dist/web when available

pnpm start:web
  -> start Vite dev server
  -> proxy /api to http://127.0.0.1:4317
```

## Privacy and Human Approval Gates

- `outputs/` is ignored by git because generated drafts can contain sensitive data.
- `.env` files are ignored by git.
- The CLI never submits an application.
- Generated packs include `Human Review Required` and `Claims to verify before sending`.
- Application status moves to `review_ready` after generation, not `applied`.
- AI mode is off by default.
- Connector features are feature-flagged and disabled by default.
- Application kits are generated under ignored `outputs/application-kits/`.
- Operator settings, resume metadata, action logs, and review notes are kept under ignored `.local/`.

## AI Provider Abstraction

```text
AIProvider.generate(prompt: string): Promise<string>
  -> MockProvider
  -> OpenRouterProvider skeleton
  -> GeminiProvider skeleton
```

The MVP uses `MockProvider` by default and does not require keys. If AI mode is enabled later, text should pass through `redactBeforeAI()` before provider calls, and generated files must include an AI mode warning.
