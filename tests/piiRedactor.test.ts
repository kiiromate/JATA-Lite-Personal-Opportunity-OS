import { describe, expect, it } from "vitest";
import { redactPII } from "../src/security/piiRedactor.js";

describe("redactPII", () => {
  it("redacts emails, phone numbers, and national ID-like long numbers", () => {
    const result = redactPII(
      "Email jane.doe@example.com, call +250 788 123 456, ID 1199887766554433 before sharing."
    );

    expect(result).not.toContain("jane.doe@example.com");
    expect(result).not.toContain("+250 788 123 456");
    expect(result).not.toContain("1199887766554433");
    expect(result).toContain("[REDACTED_EMAIL]");
    expect(result).toContain("[REDACTED_PHONE]");
    expect(result).toContain("[REDACTED_LONG_NUMBER]");
  });
});
