import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { createOpportunity, validateOpportunityInput } from "./opportunity.js";
import type { Opportunity, OpportunityInput } from "../types/index.js";

export type BulkImportFormat = "csv" | "json";

export type BulkOpportunityRow = Record<string, unknown> & {
  rowNumber?: number;
};

export interface BulkImportOptions {
  now?: string;
  update?: boolean;
  idFactory?: (rowNumber: number) => string;
}

export interface BulkImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  duplicates: number;
  invalid: number;
}

export interface BulkImportError {
  rowNumber: number;
  reason: string;
}

export interface BulkImportResult {
  opportunities: Opportunity[];
  summary: BulkImportSummary;
  errors: BulkImportError[];
}

export async function importBulkOpportunityFile(
  filePath: string,
  existing: Opportunity[],
  options: BulkImportOptions = {}
): Promise<BulkImportResult> {
  const content = await readFile(filePath, "utf8");
  const rows = parseBulkOpportunityContent(content, formatFromPath(filePath));

  return importBulkOpportunities(rows, existing, options);
}

export function parseBulkOpportunityContent(
  content: string,
  format: BulkImportFormat
): BulkOpportunityRow[] {
  if (format === "json") {
    const parsed = JSON.parse(content) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error("Bulk JSON import must be an array of opportunity rows.");
    }

    return parsed.map((row, index) => ({
      ...(isRecord(row) ? row : {}),
      rowNumber: index + 1
    }));
  }

  return parseCsvContent(content);
}

export function importBulkOpportunities(
  rows: BulkOpportunityRow[],
  existing: Opportunity[],
  options: BulkImportOptions = {}
): BulkImportResult {
  const now = options.now ?? new Date().toISOString();
  const opportunities = [...existing];
  const errors: BulkImportError[] = [];
  const summary: BulkImportSummary = {
    imported: 0,
    updated: 0,
    skipped: 0,
    duplicates: 0,
    invalid: 0
  };
  const duplicateKeys = new Map<string, number>();

  opportunities.forEach((opportunity, index) => {
    duplicateKeys.set(duplicateKeyFromOpportunity(opportunity), index);
  });

  rows.forEach((row, index) => {
    const rowNumber = row.rowNumber ?? index + 1;
    const input = rowToOpportunityInput(row);
    const validationErrors = validateBulkInput(input);

    if (validationErrors.length > 0) {
      summary.invalid += 1;
      summary.skipped += 1;
      errors.push({
        rowNumber,
        reason: validationErrors.join("; ")
      });
      return;
    }

    const duplicateKey = duplicateKeyFromInput(input);
    const existingIndex = duplicateKeys.get(duplicateKey);

    if (existingIndex !== undefined && !options.update) {
      summary.duplicates += 1;
      summary.skipped += 1;
      return;
    }

    if (existingIndex !== undefined && options.update) {
      const previous = opportunities[existingIndex];
      const replacement = createOpportunity(input, {
        id: previous.id,
        now: previous.createdAt
      });

      opportunities[existingIndex] = {
        ...replacement,
        createdAt: previous.createdAt,
        lastUpdated: now
      };
      summary.updated += 1;
      return;
    }

    const opportunity = createOpportunity(input, {
      id: options.idFactory?.(rowNumber),
      now
    });

    opportunities.push(opportunity);
    duplicateKeys.set(duplicateKey, opportunities.length - 1);
    summary.imported += 1;
  });

  return {
    opportunities,
    summary,
    errors
  };
}

function validateBulkInput(input: OpportunityInput): string[] {
  const errors = validateOpportunityInput(input);

  return errors.map((error) =>
    error === "full job description is required" ? "description is required" : error
  );
}

function rowToOpportunityInput(row: BulkOpportunityRow): OpportunityInput {
  const description = rowValue(row, "description") || rowValue(row, "jobDescription");

  return {
    company: rowValue(row, "company"),
    role: rowValue(row, "role"),
    jobDescription: description,
    url: rowValue(row, "url"),
    source: rowValue(row, "source") || "Bulk Import",
    deadline: rowValue(row, "deadline"),
    contact: rowValue(row, "contact"),
    method: rowValue(row, "method") || "web",
    notes: rowValue(row, "notes"),
    salary: rowValue(row, "salary"),
    location: rowValue(row, "location"),
    remote: rowValue(row, "remote")
  };
}

function duplicateKeyFromOpportunity(opportunity: Opportunity): string {
  return duplicateKey({
    company: opportunity.company,
    role: opportunity.role,
    url: opportunity.url,
    jobDescription: opportunity.jobDescription
  });
}

function duplicateKeyFromInput(input: OpportunityInput): string {
  return duplicateKey(input);
}

function duplicateKey(input: OpportunityInput): string {
  const company = normalizeForKey(input.company ?? "");
  const role = normalizeForKey(input.role ?? "");
  const url = normalizeForKey(input.url ?? "");
  const description = normalizeForKey(
    input.jobDescription ?? input.description ?? ""
  );
  const contentKey = url || description;

  return `${company}|${role}|${contentKey}`;
}

function rowValue(row: BulkOpportunityRow, key: string): string {
  const canonicalKey = canonicalizeKey(key);
  const found = Object.entries(row).find(
    ([candidate]) => canonicalizeKey(candidate) === canonicalKey
  );

  if (!found || found[0] === "rowNumber") {
    return "";
  }

  const value = found[1];

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim().replace(/\s+/g, " ");
}

function parseCsvContent(content: string): BulkOpportunityRow[] {
  const records = parseCsvRecords(content);

  if (records.length === 0) {
    return [];
  }

  const [headers, ...dataRows] = records;
  const normalizedHeaders = headers.map((header) => header.trim());

  return dataRows
    .map((fields, index) => ({ fields, rowNumber: index + 2 }))
    .filter(({ fields }) => fields.some((field) => field.trim().length > 0))
    .map(({ fields, rowNumber }) => {
      const row: BulkOpportunityRow = { rowNumber };

      normalizedHeaders.forEach((header, index) => {
        row[header] = fields[index] ?? "";
      });

      return row;
    });
}

function parseCsvRecords(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      currentValue += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows;
}

function formatFromPath(filePath: string): BulkImportFormat {
  const extension = extname(filePath).toLowerCase();

  if (extension === ".csv") {
    return "csv";
  }

  if (extension === ".json") {
    return "json";
  }

  throw new Error("Bulk import file must be .csv or .json.");
}

function canonicalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeForKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
