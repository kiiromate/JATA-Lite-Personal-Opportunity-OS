import type { ConnectorReadiness } from "../types/index.js";

export interface GoogleDriveConnectorConfig {
  enabled?: boolean;
  clientId?: string;
  clientSecret?: string;
  rootFolderId?: string;
}

export interface ConnectorSkipResult {
  skipped: true;
  reason: string;
}

export function createGoogleDriveConnector(config: GoogleDriveConnectorConfig) {
  const enabled = config.enabled ?? false;
  const configured = Boolean(
    config.clientId && config.clientSecret && config.rootFolderId
  );

  return {
    readiness(): ConnectorReadiness {
      return {
        name: "googleDrive",
        enabled,
        configured,
        privacyWarning:
          "Google Drive sync can upload generated packs. Keep disabled until Kaze approves credentials and folder scope.",
        setupHint: configured
          ? "Credentials and folder id are present."
          : "Future setup needs GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, and GOOGLE_DRIVE_ROOT_FOLDER_ID."
      };
    },

    async syncOpportunityPack(): Promise<ConnectorSkipResult> {
      if (!enabled) {
        return {
          skipped: true,
          reason: "Google Drive connector is disabled."
        };
      }

      return {
        skipped: true,
        reason:
          "Google Drive sync is a v0.4 skeleton. No files are uploaded yet."
      };
    }
  };
}
