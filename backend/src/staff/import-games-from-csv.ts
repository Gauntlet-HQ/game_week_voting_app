import { CsvImportValidationError } from "../errors/voting-application-errors.js";
import type { PostgresVotingStore } from "../repositories/postgres-voting-store.js";
import { parseCsvRecords, requireCsvColumns } from "./parse-csv-records.js";

export type GamesCsvImportSummary = {
  upserted: number;
  deleted: number;
  withdrawn: number;
};

const GAMES_CSV_COLUMNS = ["title", "submitter_name", "url"] as const;

export async function importGamesFromCsv(input: {
  store: PostgresVotingStore;
  csvText: string;
}): Promise<GamesCsvImportSummary> {
  const parsed = parseCsvRecords(input.csvText);
  requireCsvColumns(parsed.columns, GAMES_CSV_COLUMNS);

  const rows = parsed.records.map((record, index) => {
    const title = record["title"] ?? "";
    const submitterName = record["submitter_name"] ?? "";
    const url = record["url"] ?? "";
    if (title.length === 0 || submitterName.length === 0 || url.length === 0) {
      throw new CsvImportValidationError(
        `Games CSV row ${index + 2} has a blank title, submitter_name, or url`
      );
    }
    return { title, submitterName, url };
  });

  const urlsInSheet = new Set(rows.map((row) => row.url));

  return input.store.withTransaction(async (store) => {
    for (const row of rows) {
      await store.upsertGameByUrl(row);
    }

    const existingGames = await store.listAllGames();
    const gameIdsWithVotes = await store.listGameIdsThatHaveVotes();

    let deleted = 0;
    let withdrawn = 0;

    for (const game of existingGames) {
      if (urlsInSheet.has(game.url)) {
        continue;
      }

      if (gameIdsWithVotes.has(game.gameId)) {
        await store.markGameWithdrawnFromBallot(game.gameId);
        withdrawn += 1;
      } else {
        await store.deleteGameById(game.gameId);
        deleted += 1;
      }
    }

    return {
      upserted: rows.length,
      deleted,
      withdrawn
    };
  });
}
