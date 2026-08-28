import type { AwardCategory } from "../award-categories.js";

export type VoterRecord = {
  voterId: string;
  displayName: string;
  isStaff: boolean;
};

export type GameRecord = {
  gameId: string;
  title: string;
  submitterName: string;
  url: string;
  withdrawnFromBallot: boolean;
};

export type BallotRecord = {
  ballotId: string;
  voterId: string;
  isLocked: boolean;
  lockedAt: Date | null;
};

export type VoteRecord = {
  voteId: string;
  ballotId: string;
  voterId: string;
  category: AwardCategory;
  gameId: string;
};

export type CategoryStandingRecord = {
  category: AwardCategory;
  rank: number;
  voteCount: number;
  gameId: string;
  title: string;
  submitterName: string;
  url: string;
};
