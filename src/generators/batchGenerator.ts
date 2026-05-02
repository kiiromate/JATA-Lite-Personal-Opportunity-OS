import { enrichOpportunityWithScore } from "../core/bulkScoring.js";
import type { AIProvider } from "./aiProvider.js";
import { MockProvider } from "./aiProvider.js";
import { generateApplicationPack } from "./applicationPack.js";
import { compareRank } from "./shortlist.js";
import type {
  ApplicationPackResult,
  Opportunity,
  PriorityBand,
  Profile
} from "../types/index.js";

export interface BatchGenerateOptions {
  opportunities: Opportunity[];
  profile: Profile;
  outputRoot: string;
  top?: number;
  band?: PriorityBand;
  ids?: string[];
  date?: string;
  now?: string;
  aiProvider?: AIProvider;
}

export interface BatchGeneratedPack extends ApplicationPackResult {
  id: string;
}

export interface BatchGenerateResult {
  updatedOpportunities: Opportunity[];
  generated: BatchGeneratedPack[];
  skipped: Opportunity[];
}

export async function generateBatchApplicationPacks(
  options: BatchGenerateOptions
): Promise<BatchGenerateResult> {
  const now = options.now ?? new Date().toISOString();
  const provider = options.aiProvider ?? new MockProvider();
  const scored = options.opportunities.map((opportunity) =>
    opportunity.score && opportunity.priorityBand
      ? opportunity
      : enrichOpportunityWithScore(opportunity, options.profile, now)
  );
  const selected = selectBatch(scored, options);
  const selectedIds = new Set(selected.map((opportunity) => opportunity.id));
  const skipped = scored.filter(
    (opportunity) =>
      !selectedIds.has(opportunity.id) &&
      (opportunity.priorityBand === "D" ||
        (options.ids?.includes(opportunity.id) ?? false))
  );
  const generated: BatchGeneratedPack[] = [];
  let updatedOpportunities = scored;

  for (const opportunity of selected) {
    const result = await generateApplicationPack({
      opportunity,
      profile: options.profile,
      outputRoot: options.outputRoot,
      date: options.date,
      aiProvider: provider,
      useAI: false
    });

    generated.push({
      id: opportunity.id,
      ...result
    });

    updatedOpportunities = updatedOpportunities.map((item) =>
      item.id === opportunity.id
        ? {
            ...item,
            status: "review_ready",
            generatedPackDir: result.directory,
            packPath: result.directory,
            lastGeneratedAt: now,
            lastUpdated: now,
            nextAction: "Human review application pack"
          }
        : item
    );
  }

  return {
    updatedOpportunities,
    generated,
    skipped
  };
}

function selectBatch(
  opportunities: Opportunity[],
  options: BatchGenerateOptions
): Opportunity[] {
  if (options.ids && options.ids.length > 0) {
    const requested = new Set(options.ids);
    const byId = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));

    return options.ids
      .map((id) => byId.get(id))
      .filter((opportunity): opportunity is Opportunity =>
        Boolean(opportunity && requested.has(opportunity.id))
      );
  }

  const limit = options.top ?? 5;

  return [...opportunities]
    .filter((opportunity) => opportunity.priorityBand !== "D")
    .filter((opportunity) =>
      options.band ? opportunity.priorityBand === options.band : true
    )
    .sort((a, b) => compareRank(a, b, options.date))
    .slice(0, limit);
}
