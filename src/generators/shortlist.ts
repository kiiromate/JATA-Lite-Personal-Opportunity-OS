import type {
  ApplicationRiskLevel,
  EffortLevel,
  Opportunity,
  PriorityBand
} from "../types/index.js";

export interface ShortlistOptions {
  top?: number;
  band?: PriorityBand;
  maxRisk?: ApplicationRiskLevel;
  date?: string;
}

const bandLabels: Record<PriorityBand, string> = {
  A: "Strong pursue",
  B: "Worth review",
  C: "Maybe later",
  D: "Ignore"
};

const bandRank: Record<PriorityBand, number> = {
  A: 4,
  B: 3,
  C: 2,
  D: 1
};

const riskRank: Record<ApplicationRiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3
};

const effortRank: Record<EffortLevel, number> = {
  low: 3,
  medium: 2,
  high: 1
};

export function selectShortlist(
  opportunities: Opportunity[],
  options: ShortlistOptions = {}
): Opportunity[] {
  const date = options.date ?? localDate();
  const filtered = opportunities.filter((opportunity) => {
    if (options.band && opportunity.priorityBand !== options.band) {
      return false;
    }

    if (
      options.maxRisk &&
      riskRank[opportunity.applicationRiskLevel ?? "high"] >
        riskRank[options.maxRisk]
    ) {
      return false;
    }

    return Boolean(opportunity.priorityBand);
  });
  const ranked = [...filtered].sort((a, b) => compareRank(a, b, date));

  return typeof options.top === "number" ? ranked.slice(0, options.top) : ranked;
}

export function compareRank(
  a: Opportunity,
  b: Opportunity,
  date = localDate()
): number {
  return (
    bandRank[b.priorityBand ?? "D"] - bandRank[a.priorityBand ?? "D"] ||
    (b.score?.strategicFitScore ?? 0) - (a.score?.strategicFitScore ?? 0) ||
    deadlineUrgencyScore(b.deadline, date) -
      deadlineUrgencyScore(a.deadline, date) ||
    effortRank[b.effortEstimate ?? b.score?.effortLevel ?? "high"] -
      effortRank[a.effortEstimate ?? a.score?.effortLevel ?? "high"]
  );
}

export function generateShortlistMarkdown(
  opportunities: Opportunity[],
  options: { date?: string } = {}
): string {
  const date = options.date ?? localDate();
  const groups = groupByBand(opportunities);

  return `# Opportunity Shortlist

Date: ${date}

${(["A", "B", "C", "D"] as PriorityBand[])
  .map((band) => formatBandSection(band, groups[band] ?? [], date))
  .join("\n\n")}
`;
}

export function generateShortlistCsv(opportunities: Opportunity[]): string {
  const header = [
    "id",
    "company",
    "role",
    "priorityBand",
    "strategicFitScore",
    "applicationRiskLevel",
    "effortEstimate",
    "deadline",
    "status",
    "recommendedAction",
    "url"
  ];
  const rows = opportunities.map((opportunity) =>
    [
      opportunity.id,
      opportunity.company,
      opportunity.role,
      opportunity.priorityBand ?? "",
      opportunity.score?.strategicFitScore ?? "",
      opportunity.applicationRiskLevel ?? "",
      opportunity.effortEstimate ?? opportunity.score?.effortLevel ?? "",
      opportunity.deadline,
      opportunity.status,
      opportunity.recommendedAction ?? opportunity.nextAction ?? "",
      opportunity.url
    ]
      .map(csvEscape)
      .join(",")
  );

  return [header.join(","), ...rows].join("\n");
}

function formatBandSection(
  band: PriorityBand,
  opportunities: Opportunity[],
  date: string
): string {
  if (opportunities.length === 0) {
    return `## ${band} - ${bandLabels[band]}\n- None`;
  }

  return `## ${band} - ${bandLabels[band]}
${opportunities.map((opportunity) => formatOpportunity(opportunity, date)).join("\n")}`;
}

function formatOpportunity(opportunity: Opportunity, date: string): string {
  const score = opportunity.score?.strategicFitScore ?? "unscored";
  const risk = opportunity.applicationRiskLevel ?? "unknown";
  const effort = opportunity.effortEstimate ?? opportunity.score?.effortLevel ?? "unknown";
  const deadline = opportunity.deadline || "No deadline";
  const nextAction = opportunity.recommendedAction ?? opportunity.nextAction ?? "Decide next step";

  return [
    `- ${opportunity.company} - ${opportunity.role} (${opportunity.id})`,
    `  - Score: ${score}; risk: ${risk}; effort: ${effort}; deadline: ${deadline}`,
    `  - Why ranked: ${rankExplanation(opportunity, date)}`,
    `  - Next action: ${nextAction}`
  ].join("\n");
}

function rankExplanation(opportunity: Opportunity, date: string): string {
  const reasons = [
    `priority band ${opportunity.priorityBand ?? "unknown"}`,
    `score ${opportunity.score?.strategicFitScore ?? "unscored"}`,
    `risk ${opportunity.applicationRiskLevel ?? "unknown"}`,
    `effort ${opportunity.effortEstimate ?? opportunity.score?.effortLevel ?? "unknown"}`
  ];

  if (opportunity.deadline) {
    const days = daysUntil(opportunity.deadline, date);
    reasons.push(days < 0 ? "deadline passed" : `deadline in ${days} day(s)`);
  }

  return reasons.join(", ");
}

function groupByBand(
  opportunities: Opportunity[]
): Partial<Record<PriorityBand, Opportunity[]>> {
  return opportunities.reduce<Partial<Record<PriorityBand, Opportunity[]>>>(
    (groups, opportunity) => {
      const band = opportunity.priorityBand ?? "D";
      groups[band] = [...(groups[band] ?? []), opportunity];
      return groups;
    },
    {}
  );
}

function deadlineUrgencyScore(deadline: string, date: string): number {
  if (!deadline) {
    return 0;
  }

  const days = daysUntil(deadline, date);

  if (days < 0) {
    return 100;
  }

  if (days <= 3) {
    return 80;
  }

  if (days <= 7) {
    return 60;
  }

  if (days <= 14) {
    return 30;
  }

  return 10;
}

function daysUntil(deadline: string, date: string): number {
  const start = Date.parse(`${date}T00:00:00.000Z`);
  const end = Date.parse(`${deadline}T00:00:00.000Z`);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 999;
  }

  return Math.floor((end - start) / 86_400_000);
}

function localDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function csvEscape(value: string | number): string {
  const text = String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}
