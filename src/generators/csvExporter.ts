import type { Opportunity } from "../types/index.js";

const columns = [
  "id",
  "createdAt",
  "company",
  "role",
  "source",
  "url",
  "deadline",
  "method",
  "status",
  "strategicFitScore",
  "decision",
  "priorityBand",
  "applicationRiskLevel",
  "effortEstimate",
  "recommendedAction",
  "nextAction",
  "appliedAt",
  "followUpDate",
  "lastUpdated",
  "packPath"
] as const;

export function opportunitiesToCsv(opportunities: Opportunity[]): string {
  const header = columns.join(",");
  const rows = opportunities.map((opportunity) =>
    [
      opportunity.id,
      opportunity.createdAt,
      opportunity.company,
      opportunity.role,
      opportunity.source,
      opportunity.url,
      opportunity.deadline,
      opportunity.method,
      opportunity.status,
      opportunity.score?.strategicFitScore ?? "",
      opportunity.score?.decision ?? "",
      opportunity.priorityBand ?? "",
      opportunity.applicationRiskLevel ?? "",
      opportunity.effortEstimate ?? "",
      opportunity.recommendedAction ?? "",
      opportunity.nextAction ?? "",
      opportunity.appliedAt ?? "",
      opportunity.followUpDate ?? "",
      opportunity.lastUpdated,
      opportunity.packPath ?? opportunity.generatedPackDir ?? ""
    ]
      .map(csvEscape)
      .join(",")
  );

  return [header, ...rows].join("\n");
}

function csvEscape(value: string | number): string {
  const text = String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}
