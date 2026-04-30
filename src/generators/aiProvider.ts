export interface AIProvider {
  readonly name: string;
  generate(prompt: string): Promise<string>;
}

export class MockProvider implements AIProvider {
  readonly name = "mock";

  async generate(prompt: string): Promise<string> {
    return [
      "Mock provider response.",
      "No external AI service was called.",
      `Prompt length after redaction: ${prompt.length} characters.`
    ].join("\n");
  }
}

export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";

  constructor(
    private readonly apiKey = process.env.OPENROUTER_API_KEY,
    private readonly model = process.env.OPENROUTER_MODEL ??
      "openrouter/auto"
  ) {}

  async generate(_prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is required to use OpenRouterProvider."
      );
    }

    throw new Error(
      `OpenRouterProvider skeleton configured for ${this.model}; network generation is intentionally not implemented in MVP v0.1.`
    );
  }
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";

  constructor(
    private readonly apiKey = process.env.GEMINI_API_KEY,
    private readonly model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash"
  ) {}

  async generate(_prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is required to use GeminiProvider.");
    }

    throw new Error(
      `GeminiProvider skeleton configured for ${this.model}; network generation is intentionally not implemented in MVP v0.1.`
    );
  }
}

export function createAIProviderFromEnv(env = process.env): {
  provider: AIProvider;
  useAI: boolean;
} {
  const providerName = (env.JATA_AI_PROVIDER ?? "mock").toLowerCase();
  const useAI = env.JATA_AI_MODE === "true" && providerName !== "mock";

  if (providerName === "openrouter") {
    return {
      provider: new OpenRouterProvider(
        env.OPENROUTER_API_KEY,
        env.OPENROUTER_MODEL
      ),
      useAI
    };
  }

  if (providerName === "gemini") {
    return {
      provider: new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL),
      useAI
    };
  }

  return { provider: new MockProvider(), useAI: false };
}
