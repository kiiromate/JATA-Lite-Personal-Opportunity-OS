# n8n Bridge Foundation

JATA Lite v0.4 includes a local ingest endpoint for future n8n workflows. n8n is not required to run the app.

## Endpoint

```text
POST /api/ingest/opportunity
```

The endpoint accepts the same opportunity schema as bulk import and writes to local JSON storage only after validation and deduplication.

Required fields:

- `company`
- `role`
- `description` or `jobDescription`

Optional fields:

- `url`
- `source`
- `deadline`
- `contact`
- `method`
- `notes`
- `salary`
- `location`
- `remote`

## Example Payload

```json
{
  "company": "Example Systems",
  "role": "Automation Consultant",
  "description": "Role focused on operations automation, implementation, and stakeholder coordination.",
  "url": "https://example.com/jobs/automation-consultant",
  "source": "n8n",
  "deadline": "2026-06-15",
  "method": "web",
  "notes": "Imported from a future watched source."
}
```

## Response Shape

```json
{
  "summary": {
    "imported": 1,
    "updated": 0,
    "skipped": 0,
    "duplicates": 0,
    "invalid": 0
  },
  "errors": [],
  "opportunities": []
}
```

## Safety Rules

- The endpoint imports only. It does not score, generate packs, submit applications, send emails, or call external services.
- Duplicate opportunities are skipped by the same company/role/URL or normalized description logic used by bulk import.
- Invalid payloads return `400` with validation errors.
- Actions are logged locally in `.local/action-log.jsonl`.
- If a shared webhook value is added later, store it in local environment configuration, not source code.

## Future n8n Workflow Shape

1. Trigger from a manual webhook, watched sheet, or curated source.
2. Normalize source fields into the JATA Lite opportunity schema.
3. POST to the local endpoint.
4. Review imported rows in the console before scoring or generating packs.
