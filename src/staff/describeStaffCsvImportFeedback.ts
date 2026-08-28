import type {
  GamesCsvImportSummary,
  VoterRosterCsvImportSummary,
} from "../api/votingApiTypes";

export function describeGamesCsvImportSummary(
  summary: GamesCsvImportSummary,
): string {
  return `The games ledger accepted ${summary.upserted} rows (${summary.deleted} deleted, ${summary.withdrawn} withdrawn for existing votes).`;
}

export function describeVoterRosterCsvImportSummary(
  summary: VoterRosterCsvImportSummary,
): string {
  return `The roster ledger accepted ${summary.upserted} names (${summary.deleted} deleted, ${summary.keptBecauseBallotExists} kept because a ballot exists).`;
}
