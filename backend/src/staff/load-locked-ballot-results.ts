import { AWARD_CATEGORIES, type AwardCategory } from "../award-categories.js";
import type { PostgresVotingStore } from "../repositories/postgres-voting-store.js";

export type StaffResultsResponse = {
  lockedBallotCount: number;
  categories: CategoryResults[];
};

export type CategoryResults = {
  category: AwardCategory;
  standings: StandingRow[];
};

export type StandingRow = {
  rank: number;
  voteCount: number;
  isTied: boolean;
  game: {
    gameId: string;
    title: string;
    submitterName: string;
    url: string;
  };
};

export async function loadLockedBallotResults(
  store: PostgresVotingStore
): Promise<StaffResultsResponse> {
  const lockedBallotCount = await store.countLockedBallots();
  const standings = await store.listLockedBallotStandings();

  const voteCountByCategory = new Map<AwardCategory, Map<number, number>>();
  for (const standing of standings) {
    const byVoteCount =
      voteCountByCategory.get(standing.category) ?? new Map<number, number>();
    byVoteCount.set(
      standing.voteCount,
      (byVoteCount.get(standing.voteCount) ?? 0) + 1
    );
    voteCountByCategory.set(standing.category, byVoteCount);
  }

  const categories: CategoryResults[] = AWARD_CATEGORIES.map((category) => ({
    category,
    standings: standings
      .filter((standing) => standing.category === category)
      .map((standing) => ({
        rank: standing.rank,
        voteCount: standing.voteCount,
        isTied:
          (voteCountByCategory.get(category)?.get(standing.voteCount) ?? 0) > 1,
        game: {
          gameId: standing.gameId,
          title: standing.title,
          submitterName: standing.submitterName,
          url: standing.url
        }
      }))
  }));

  return { lockedBallotCount, categories };
}
