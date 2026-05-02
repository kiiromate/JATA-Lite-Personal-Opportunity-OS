import type { ConnectorReadiness } from "../types/index.js";

export interface GoogleSheetsConnectorConfig {
  enabled?: boolean;
  clientId?: string;
  clientSecret?: string;
  spreadsheetId?: string;
}

export interface ConnectorSkipResult {
  skipped: true;
  reason: string;
}

export function createGoogleSheetsConnector(config: GoogleSheetsConnectorConfig) {
  const enabled = config.enabled ?? false;
  const configured = Boolean(
    config.clientId && config.clientSecret && config.spreadsheetId
  );

  return {
    readiness(): ConnectorReadiness {
      return {
        name: "googleSheets",
        enabled,
        configured,
        privacyWarning:
          "Google Sheets sync can send tracker rows to a Google account. Keep disabled until Kaze approves columns, account, and sharing scope.",
        setupHint: configured
          ? "Credentials and spreadsheet id are present."
          : "Future setup needs GOOGLE_SHEETS_CLIENT_ID, GOOGLE_SHEETS_CLIENT_SECRET, and GOOGLE_SHEETS_SPREADSHEET_ID."
      };
    },

    async syncTrackerRows(): Promise<ConnectorSkipResult> {
      if (!enabled) {
        return {
          skipped: true,
          reason: "Google Sheets connector is disabled."
        };
      }

      return {
        skipped: true,
        reason:
          "Google Sheets sync is a v0.4 skeleton. No tracker rows are sent yet."
      };
    }
  };
}
