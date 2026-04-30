import { describe, expect, it } from "vitest";
import { createAIProviderFromEnv } from "../src/generators/aiProvider.js";

describe("createAIProviderFromEnv", () => {
  it("uses the provided environment object instead of reading process.env directly", async () => {
    const { provider, useAI } = createAIProviderFromEnv({
      JATA_AI_PROVIDER: "openrouter",
      JATA_AI_MODE: "true",
      OPENROUTER_API_KEY: "test-key",
      OPENROUTER_MODEL: "test-model"
    });

    expect(provider.name).toBe("openrouter");
    expect(useAI).toBe(true);
    await expect(provider.generate("test prompt")).rejects.toThrow(
      /test-model/
    );
  });
});
