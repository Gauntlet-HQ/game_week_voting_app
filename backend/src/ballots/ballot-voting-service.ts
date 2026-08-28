import {
  AWARD_CATEGORIES,
  isAwardCategory,
  type AwardCategory
} from "../award-categories.js";
import {
  BallotAlreadyLockedError,
  BallotLockRequiresFourNonWithdrawnGamesError,
  DuplicateCategoryOnBallotError,
  WithdrawnOrUnknownGameNotVotableError
} from "../errors/voting-application-errors.js";
import type { BallotRecord, VoteRecord } from "../domain/voting-records.js";
import type { PostgresVotingStore } from "../repositories/postgres-voting-store.js";

export type BallotVoteInput = {
  category: AwardCategory;
  gameId: string;
};

export type BallotSnapshot = {
  ballotId: string | null;
  isLocked: boolean;
  lockedAt: Date | null;
  votes: VoteRecord[];
};

export async function readBallotForVoter(input: {
  store: PostgresVotingStore;
  voterId: string;
}): Promise<BallotSnapshot> {
  const ballot = await input.store.findBallotByVoterId(input.voterId);
  if (!ballot) {
    return {
      ballotId: null,
      isLocked: false,
      lockedAt: null,
      votes: []
    };
  }

  const votes = await input.store.listVotesForBallot(ballot.ballotId);
  return toSnapshot(ballot, votes);
}

export async function replaceDraftBallotVotes(input: {
  store: PostgresVotingStore;
  voterId: string;
  votes: BallotVoteInput[];
}): Promise<BallotSnapshot> {
  assertNoDuplicateCategories(input.votes);

  return input.store.withTransaction(async (store) => {
    const existingBallot = await store.findBallotByVoterId(input.voterId);
    if (existingBallot?.isLocked) {
      throw new BallotAlreadyLockedError();
    }

    await assertEveryVoteTargetsAnActiveGame(store, input.votes);
    const ballot =
      existingBallot ?? (await store.createUnlockedBallotForVoter(input.voterId));
    await store.replaceDraftVotesOnBallot({
      ballotId: ballot.ballotId,
      voterId: input.voterId,
      votes: input.votes
    });

    const votes = await store.listVotesForBallot(ballot.ballotId);
    return toSnapshot(ballot, votes);
  });
}

export async function lockBallotForVoter(input: {
  store: PostgresVotingStore;
  voterId: string;
}): Promise<BallotSnapshot> {
  return input.store.withTransaction(async (store) => {
    const ballot = await store.findBallotByVoterId(input.voterId);
    if (!ballot) {
      throw new BallotLockRequiresFourNonWithdrawnGamesError();
    }
    if (ballot.isLocked) {
      throw new BallotAlreadyLockedError();
    }

    const votes = await store.listVotesForBallot(ballot.ballotId);
    await assertBallotCanBeLocked(store, votes);

    const lockedBallot = await store.lockBallot(ballot.ballotId);
    const lockedVotes = await store.listVotesForBallot(lockedBallot.ballotId);
    return toSnapshot(lockedBallot, lockedVotes);
  });
}

function assertNoDuplicateCategories(votes: BallotVoteInput[]): void {
  const seen = new Set<AwardCategory>();
  for (const vote of votes) {
    if (!isAwardCategory(vote.category)) {
      throw new DuplicateCategoryOnBallotError();
    }
    if (seen.has(vote.category)) {
      throw new DuplicateCategoryOnBallotError();
    }
    seen.add(vote.category);
  }
}

async function assertEveryVoteTargetsAnActiveGame(
  store: PostgresVotingStore,
  votes: BallotVoteInput[]
): Promise<void> {
  for (const vote of votes) {
    const game = await store.findGameById(vote.gameId);
    if (!game || game.withdrawnFromBallot) {
      throw new WithdrawnOrUnknownGameNotVotableError();
    }
  }
}

async function assertBallotCanBeLocked(
  store: PostgresVotingStore,
  votes: VoteRecord[]
): Promise<void> {
  const categoriesPresent = new Set(votes.map((vote) => vote.category));
  const hasAllCategories = AWARD_CATEGORIES.every((category) =>
    categoriesPresent.has(category)
  );
  if (!hasAllCategories || votes.length !== AWARD_CATEGORIES.length) {
    throw new BallotLockRequiresFourNonWithdrawnGamesError();
  }

  await assertEveryVoteTargetsAnActiveGame(
    store,
    votes.map((vote) => ({ category: vote.category, gameId: vote.gameId }))
  );
}

function toSnapshot(ballot: BallotRecord, votes: VoteRecord[]): BallotSnapshot {
  return {
    ballotId: ballot.ballotId,
    isLocked: ballot.isLocked,
    lockedAt: ballot.lockedAt,
    votes
  };
}
