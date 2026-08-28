import { isPlainRecord } from "../isPlainRecord";
import {
  isAwardCategory,
  type AwardCategory,
} from "../awards/awardCategories";

export type PublicVoterRosterEntry = {
  displayName: string;
};

export type HonorSystemSession = {
  token: string;
  voterId: string;
  displayName: string;
  isStaff: boolean;
};

export type GameListedOnTheBallot = {
  gameId: string;
  title: string;
  submitterName: string;
  url: string;
};

export type BallotVote = {
  category: AwardCategory;
  gameId: string;
};

export type VoterBallot = {
  ballotId: string | null;
  isLocked: boolean;
  lockedAt: string | null;
  votes: BallotVote[];
};

export type GamesCsvImportSummary = {
  upserted: number;
  deleted: number;
  withdrawn: number;
};

export type VoterRosterCsvImportSummary = {
  upserted: number;
  deleted: number;
  keptBecauseBallotExists: number;
};

export type StaffResultsStanding = {
  rank: number;
  voteCount: number;
  isTied: boolean;
  game: GameListedOnTheBallot;
};

export type StaffResultsCategoryStandings = {
  category: AwardCategory;
  standings: StaffResultsStanding[];
};

export type StaffLockedBallotResults = {
  lockedBallotCount: number;
  categories: StaffResultsCategoryStandings[];
};

export type VotingApiClient = {
  fetchPublicVoterRosterDisplayNames: () => Promise<string[]>;
  createHonorSystemSessionWithOptionalSharedStaffPassword: (input: {
    displayName: string;
    sharedStaffPassword: string;
  }) => Promise<HonorSystemSession>;
  fetchGamesListedOnTheBallot: (input: {
    sessionToken: string;
  }) => Promise<GameListedOnTheBallot[]>;
  fetchBallotForCurrentVoter: (input: {
    sessionToken: string;
  }) => Promise<VoterBallot>;
  replaceUnlockedDraftBallotVotes: (input: {
    sessionToken: string;
    votes: BallotVote[];
  }) => Promise<VoterBallot>;
  lockCompletedBallotForCurrentVoter: (input: {
    sessionToken: string;
  }) => Promise<VoterBallot>;
  importGamesFromCsvText: (input: {
    sessionToken: string;
    csvText: string;
  }) => Promise<GamesCsvImportSummary>;
  importVoterRosterFromCsvText: (input: {
    sessionToken: string;
    csvText: string;
  }) => Promise<VoterRosterCsvImportSummary>;
  fetchLockedBallotResultsForStaff: (input: {
    sessionToken: string;
  }) => Promise<StaffLockedBallotResults>;
};

export function isHonorSystemSession(
  value: unknown,
): value is HonorSystemSession {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    typeof value.token === "string" &&
    value.token.length > 0 &&
    typeof value.voterId === "string" &&
    value.voterId.length > 0 &&
    typeof value.displayName === "string" &&
    value.displayName.length > 0 &&
    typeof value.isStaff === "boolean"
  );
}

export function isGameListedOnTheBallot(
  value: unknown,
): value is GameListedOnTheBallot {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    typeof value.gameId === "string" &&
    value.gameId.length > 0 &&
    typeof value.title === "string" &&
    value.title.length > 0 &&
    typeof value.submitterName === "string" &&
    value.submitterName.length > 0 &&
    typeof value.url === "string"
  );
}

export function isBallotVote(value: unknown): value is BallotVote {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    isAwardCategory(value.category) &&
    typeof value.gameId === "string" &&
    value.gameId.length > 0
  );
}

export function isVoterBallot(value: unknown): value is VoterBallot {
  if (!isPlainRecord(value)) {
    return false;
  }

  const ballotIdIsReadable =
    value.ballotId === null ||
    (typeof value.ballotId === "string" && value.ballotId.length > 0);
  const lockedAtIsReadable =
    value.lockedAt === null ||
    (typeof value.lockedAt === "string" && value.lockedAt.length > 0);

  return (
    ballotIdIsReadable &&
    typeof value.isLocked === "boolean" &&
    lockedAtIsReadable &&
    Array.isArray(value.votes) &&
    value.votes.every(isBallotVote)
  );
}

export function isGamesCsvImportSummary(
  value: unknown,
): value is GamesCsvImportSummary {
  return (
    isPlainRecord(value) &&
    isNonNegativeInteger(value.upserted) &&
    isNonNegativeInteger(value.deleted) &&
    isNonNegativeInteger(value.withdrawn)
  );
}

export function isVoterRosterCsvImportSummary(
  value: unknown,
): value is VoterRosterCsvImportSummary {
  return (
    isPlainRecord(value) &&
    isNonNegativeInteger(value.upserted) &&
    isNonNegativeInteger(value.deleted) &&
    isNonNegativeInteger(value.keptBecauseBallotExists)
  );
}

export function isStaffResultsStanding(
  value: unknown,
): value is StaffResultsStanding {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    isPositiveInteger(value.rank) &&
    isNonNegativeInteger(value.voteCount) &&
    typeof value.isTied === "boolean" &&
    isGameListedOnTheBallot(value.game)
  );
}

export function isStaffResultsCategoryStandings(
  value: unknown,
): value is StaffResultsCategoryStandings {
  return (
    isPlainRecord(value) &&
    isAwardCategory(value.category) &&
    Array.isArray(value.standings) &&
    value.standings.every(isStaffResultsStanding)
  );
}

export function isStaffLockedBallotResults(
  value: unknown,
): value is StaffLockedBallotResults {
  return (
    isPlainRecord(value) &&
    isNonNegativeInteger(value.lockedBallotCount) &&
    Array.isArray(value.categories) &&
    value.categories.every(isStaffResultsCategoryStandings)
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}
