import type {
  GameListedOnTheBallot,
  VoterBallot,
} from "../api/votingApiTypes";

export const dungeonCrawlerGame: GameListedOnTheBallot = {
  gameId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
  title: "Dungeon Crawler",
  submitterName: "Ada Lovelace",
  url: "https://example.com/dungeon",
};

export const lanternsOfQeynosGame: GameListedOnTheBallot = {
  gameId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
  title: "Lanterns of Qeynos",
  submitterName: "Mira",
  url: "https://example.com/lanterns",
};

export const riftOfTheHollowKingGame: GameListedOnTheBallot = {
  gameId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
  title: "Rift of the Hollow King",
  submitterName: "Thalen",
  url: "https://example.com/rift",
};

export const stormsOverKaranaGame: GameListedOnTheBallot = {
  gameId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4",
  title: "Storms over Karana",
  submitterName: "Brannoc",
  url: "https://example.com/karana",
};

export const fourGamesOnTheBallot: GameListedOnTheBallot[] = [
  dungeonCrawlerGame,
  lanternsOfQeynosGame,
  riftOfTheHollowKingGame,
  stormsOverKaranaGame,
];

export const emptyUnlockedVoterBallot: VoterBallot = {
  ballotId: null,
  isLocked: false,
  lockedAt: null,
  votes: [],
};

export const completeUnlockedVoterBallot: VoterBallot = {
  ballotId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
  isLocked: false,
  lockedAt: null,
  votes: [
    {
      category: "technical_achievement",
      gameId: dungeonCrawlerGame.gameId,
    },
    {
      category: "creative_or_fun_gameplay",
      gameId: lanternsOfQeynosGame.gameId,
    },
    {
      category: "visuals_or_graphics",
      gameId: riftOfTheHollowKingGame.gameId,
    },
    {
      category: "best_overall",
      gameId: stormsOverKaranaGame.gameId,
    },
  ],
};

export const sealedVoterBallot: VoterBallot = {
  ...completeUnlockedVoterBallot,
  isLocked: true,
  lockedAt: "2026-08-28T17:00:00.000Z",
};
