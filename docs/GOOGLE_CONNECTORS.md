# Google Connector Foundations

JATA Lite v0.4 adds disabled-by-default skeletons for future Google Drive and Google Sheets sync:

- `src/connectors/googleDrive.ts`
- `src/connectors/googleSheets.ts`

The connectors expose readiness and safe no-op sync methods. They do not authenticate, upload, download, or modify Google data in v0.4.

## Current Behavior

- Connectors are disabled by default.
- Missing credentials do not break tests, CLI commands, API startup, or the web console.
- Settings shows readiness, configuration status, setup hints, and privacy warnings.
- No Google API calls occur.

## Future Environment Variables

Drive:

```bash
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_ROOT_FOLDER_ID=
```

Sheets:

```bash
GOOGLE_SHEETS_CLIENT_ID=
GOOGLE_SHEETS_CLIENT_SECRET=
GOOGLE_SHEETS_SPREADSHEET_ID=
```

Keep real values out of git. Use local environment configuration only.

## Intended Future Drive Sync

- Export selected application kits or generated packs to a user-approved Drive folder.
- Preserve local pack folder structure.
- Log every upload locally.
- Require a user-approved action before upload.

## Intended Future Sheets Sync

- Export tracker rows to a user-approved spreadsheet.
- Map explicit columns from `opportunitiesToCsv()`.
- Avoid syncing notes or contact fields unless Kaze explicitly approves them.
- Log every sync locally.

## Non-Goals For v0.4

- No OAuth flow.
- No Drive folder watcher.
- No automatic upload.
- No automatic sheet update.
- No credential storage in source code.
