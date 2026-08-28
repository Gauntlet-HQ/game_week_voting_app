import type {
  GamesCsvImportSummary,
  StaffLockedBallotResults,
  VoterRosterCsvImportSummary,
} from "../api/votingApiTypes";
import {
  dungeonCrawlerGame,
  lanternsOfQeynosGame,
  riftOfTheHollowKingGame,
  stormsOverKaranaGame,
} from "./votingHallTestFixtures";

export const successfulGamesCsvImportSummary: GamesCsvImportSummary = {
  upserted: 2,
  deleted: 1,
  withdrawn: 0,
};

export const successfulVoterRosterCsvImportSummary: VoterRosterCsvImportSummary =
  {
    upserted: 3,
    deleted: 1,
    keptBecauseBallotExists: 1,
  };

export const staffLockedBallotResults: StaffLockedBallotResults = {
  lockedBallotCount: 2,
  categories: [
    {
      category: "technical_achievement",
      standings: [
        {
          rank: 1,
          voteCount: 2,
          isTied: false,
          game: dungeonCrawlerGame,
        },
      ],
    },
    {
      category: "creative_or_fun_gameplay",
      standings: [
        {
          rank: 1,
          voteCount: 1,
          isTied: true,
          game: lanternsOfQeynosGame,
        },
        {
          rank: 1,
          voteCount: 1,
          isTied: true,
          game: riftOfTheHollowKingGame,
        },
      ],
    },
    {
      category: "visuals_or_graphics",
      standings: [],
    },
    {
      category: "best_overall",
      standings: [
        {
          rank: 1,
          voteCount: 2,
          isTied: false,
          game: stormsOverKaranaGame,
        },
      ],
    },
  ],
};
