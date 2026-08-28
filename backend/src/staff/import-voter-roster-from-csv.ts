import { CsvImportValidationError } from "../errors/voting-application-errors.js";
import type { PostgresVotingStore } from "../repositories/postgres-voting-store.js";
import { parseCsvRecords, requireCsvColumns } from "./parse-csv-records.js";

export type VoterRosterCsvImportSummary = {
  upserted: number;
  deleted: number;
  keptBecauseBallotExists: number;
};

const VOTER_ROSTER_CSV_COLUMNS = ["display_name", "is_staff"] as const;

export async function importVoterRosterFromCsv(input: {
  store: PostgresVotingStore;
  csvText: string;
}): Promise<VoterRosterCsvImportSummary> {
  const parsed = parseCsvRecords(input.csvText);
  requireCsvColumns(parsed.columns, VOTER_ROSTER_CSV_COLUMNS);

  const rows = parsed.records.map((record, index) => {
    const displayName = record["display_name"] ?? "";
    const isStaffRaw = record["is_staff"] ?? "";
    if (displayName.length === 0) {
      throw new CsvImportValidationError(
        `Voter roster CSV row ${index + 2} has a blank display_name`
      );
    }
    return {
      displayName,
      isStaff: parseIsStaffFlag(isStaffRaw, index + 2)
    };
  });

  const namesInSheet = new Set(rows.map((row) => row.displayName.toLowerCase()));

  return input.store.withTransaction(async (store) => {
    for (const row of rows) {
      await store.upsertVoterByLowerDisplayName(row);
    }

    const existingVoters = await store.listAllVoters();
    const voterIdsWithBallots = await store.listVoterIdsThatHaveBallots();

    let deleted = 0;
    let keptBecauseBallotExists = 0;

    for (const voter of existingVoters) {
      if (namesInSheet.has(voter.displayName.toLowerCase())) {
        continue;
      }

      if (voterIdsWithBallots.has(voter.voterId)) {
        keptBecauseBallotExists += 1;
        continue;
      }

      await store.deleteVoterById(voter.voterId);
      deleted += 1;
    }

    return {
      upserted: rows.length,
      deleted,
      keptBecauseBallotExists
    };
  });
}

function parseIsStaffFlag(raw: string, rowNumber: number): boolean {
  const normalized = raw.trim().toLowerCase();
  if (["true", "t", "yes", "y", "1"].includes(normalized)) {
    return true;
  }
  if (["false", "f", "no", "n", "0"].includes(normalized)) {
    return false;
  }
  throw new CsvImportValidationError(
    `Voter roster CSV row ${rowNumber} has an invalid is_staff value: ${raw}`
  );
}
