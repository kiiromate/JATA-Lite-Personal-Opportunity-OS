import type { Opportunity } from "../types/index.js";

export interface JobDescriptionCleaningResult {
  original: string;
  cleaned: string;
  changed: boolean;
  summary: string[];
}

export function cleanJobDescription(raw: string): JobDescriptionCleaningResult {
  const original = raw;
  const lineResult = removeDuplicatedLines(raw);
  const normalized = normalizeWhitespace(lineResult.text);
  const fragmentResult = removeRepeatedWordFragments(normalized);
  const cleaned = normalizeWhitespace(fragmentResult.text);
  const summary: string[] = [];

  if (lineResult.removed > 0) {
    summary.push(`Removed ${lineResult.removed} duplicated block(s).`);
  }

  if (fragmentResult.removed > 0) {
    summary.push(`Removed ${fragmentResult.removed} repeated fragment(s).`);
  }

  if (summary.length === 0 && cleaned !== original) {
    summary.push("Normalized whitespace and paste artifacts.");
  }

  if (summary.length === 0) {
    summary.push("No obvious duplicate blocks found; preserved source details.");
  }

  return {
    original,
    cleaned,
    changed: cleaned !== original,
    summary
  };
}

export function cleanOpportunityJobDescription(
  opportunity: Opportunity,
  now = new Date().toISOString()
): Opportunity {
  const sourceDescription =
    opportunity.jobDescriptionOriginal ?? opportunity.jobDescription;
  const result = cleanJobDescription(sourceDescription);

  return {
    ...opportunity,
    jobDescription: result.cleaned,
    jobDescriptionOriginal:
      opportunity.jobDescriptionOriginal ?? result.original,
    jobDescriptionCleaning: {
      cleanedAt: now,
      originalLength: result.original.length,
      cleanedLength: result.cleaned.length,
      summary: result.summary,
      previousScore: opportunity.score
    },
    status: "needs_regeneration",
    nextAction: "Regenerate application pack",
    lastUpdated: now
  };
}

function removeDuplicatedLines(raw: string): { text: string; removed: number } {
  const seen = new Set<string>();
  const lines: string[] = [];
  let removed = 0;

  for (const rawLine of raw.replace(/\r\n/g, "\n").split("\n")) {
    const line = normalizeWhitespace(rawLine.replace(/^>\s?/, ""));

    if (!line) {
      continue;
    }

    const key = normalizeKey(line);
    const previous = lines[lines.length - 1];

    if (previous) {
      const previousKey = normalizeKey(previous);

      if (key === previousKey) {
        removed += 1;
        continue;
      }

      if (isBrokenRepeat(previousKey, key)) {
        lines[lines.length - 1] =
          line.length > previous.length ? line : previous;
        removed += 1;
        continue;
      }
    }

    if (line.length > 40 && seen.has(key)) {
      removed += 1;
      continue;
    }

    seen.add(key);
    lines.push(line);
  }

  return {
    text: lines.join(" "),
    removed
  };
}

function removeRepeatedWordFragments(text: string): {
  text: string;
  removed: number;
} {
  const words = text.split(" ").filter(Boolean);
  const output: string[] = [];
  let removed = 0;
  let index = 0;

  while (index < words.length) {
    let matchedSize = 0;

    for (let size = Math.min(16, Math.floor((words.length - index) / 2)); size >= 3; size -= 1) {
      if (sameWords(words, index, index + size, size)) {
        matchedSize = size;
        break;
      }
    }

    if (matchedSize > 0) {
      output.push(...words.slice(index, index + matchedSize));
      index += matchedSize;

      while (sameWords(words, index - matchedSize, index, matchedSize)) {
        index += matchedSize;
        removed += 1;
      }

      continue;
    }

    output.push(words[index]);
    index += 1;
  }

  return {
    text: output.join(" "),
    removed
  };
}

function sameWords(
  words: string[],
  leftStart: number,
  rightStart: number,
  size: number
): boolean {
  if (rightStart + size > words.length) {
    return false;
  }

  for (let offset = 0; offset < size; offset += 1) {
    if (
      normalizeKey(words[leftStart + offset]) !==
      normalizeKey(words[rightStart + offset])
    ) {
      return false;
    }
  }

  return true;
}

function isBrokenRepeat(previous: string, current: string): boolean {
  return (
    previous.length > 30 &&
    current.length > 30 &&
    (previous.startsWith(current) || current.startsWith(previous))
  );
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
