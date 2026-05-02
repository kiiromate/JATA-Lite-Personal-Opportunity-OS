import { describe, expect, it } from "vitest";
import { createGoogleDriveConnector } from "../src/connectors/googleDrive.js";
import { createGoogleSheetsConnector } from "../src/connectors/googleSheets.js";

describe("connector foundations", () => {
  it("keeps Google Drive disabled without credentials", async () => {
    const connector = createGoogleDriveConnector({});

    expect(connector.readiness()).toMatchObject({
      name: "googleDrive",
      enabled: false,
      configured: false
    });
    await expect(connector.syncOpportunityPack()).resolves.toMatchObject({
      skipped: true,
      reason: "Google Drive connector is disabled."
    });
  });

  it("keeps Google Sheets disabled without credentials", async () => {
    const connector = createGoogleSheetsConnector({});

    expect(connector.readiness()).toMatchObject({
      name: "googleSheets",
      enabled: false,
      configured: false
    });
    await expect(connector.syncTrackerRows()).resolves.toMatchObject({
      skipped: true,
      reason: "Google Sheets connector is disabled."
    });
  });
});
