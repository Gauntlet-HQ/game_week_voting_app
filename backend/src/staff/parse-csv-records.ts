import { parse } from "csv-parse/sync";
import { CsvImportValidationError } from "../errors/voting-application-errors.js";

export type ParsedCsvTable = {
  columns: string[];
  records: Record<string, string>[];
};

export function parseCsvRecords(csvText: string): ParsedCsvTable {
  const trimmed = stripBom(csvText).trim();
  if (trimmed.length === 0) {
    throw new CsvImportValidationError("CSV body is empty");
  }

  const columns: string[] = [];

  try {
    const records = parse(trimmed, {
      columns: (header: string[]) => {
        const normalized = header.map((column) => column.trim());
        columns.splice(0, columns.length, ...normalized);
        return normalized;
      },
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
      bom: true
    }) as Record<string, string>[];

    return {
      columns,
      records: records.map((record) => {
        const normalized: Record<string, string> = {};
        for (const [key, value] of Object.entries(record)) {
          normalized[key] =
            typeof value === "string" ? value.trim() : String(value);
        }
        return normalized;
      })
    };
  } catch (error) {
    if (error instanceof CsvImportValidationError) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "CSV could not be parsed";
    throw new CsvImportValidationError(message);
  }
}

export function requireCsvColumns(
  columns: string[],
  requiredColumns: readonly string[]
): void {
  const headerKeys = new Set(columns);
  const missing = requiredColumns.filter((column) => !headerKeys.has(column));
  if (missing.length > 0) {
    throw new CsvImportValidationError(
      `CSV is missing required column(s): ${missing.join(", ")}`
    );
  }
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}
