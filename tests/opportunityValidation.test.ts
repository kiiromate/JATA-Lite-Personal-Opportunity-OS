import { describe, expect, it } from "vitest";
import { createOpportunity } from "../src/core/opportunity.js";

describe("createOpportunity", () => {
  it("creates a valid opportunity with normalized strings and defaults", () => {
    const opportunity = createOpportunity(
      {
        company: "  Acme  ",
        role: "  Digital Operations Lead  ",
        url: "https://example.com/role",
        source: "Referral",
        jobDescription: "A useful role description with enough detail.",
        deadline: "2026-05-20",
        contact: "Jane Doe",
        method: "referral",
        notes: "Warm intro possible"
      },
      {
        id: "opp_test",
        now: "2026-04-30T10:00:00.000Z"
      }
    );

    expect(opportunity).toMatchObject({
      id: "opp_test",
      company: "Acme",
      role: "Digital Operations Lead",
      status: "captured",
      nextAction: "Score opportunity"
    });
  });

  it("rejects invalid required fields and unsupported methods", () => {
    expect(() =>
      createOpportunity({
        company: "",
        role: "",
        url: "not-a-url",
        source: "",
        jobDescription: "",
        deadline: "tomorrow",
        contact: "",
        method: "carrier pigeon",
        notes: ""
      })
    ).toThrow(/company/i);
  });
});
