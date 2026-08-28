import type { AwardCategory } from "../awards/awardCategories";
import { AWARD_CATEGORIES } from "../awards/awardCategories";
import type { BallotVote } from "../api/votingApiTypes";

export type SelectedGameIdByAwardCategory = Partial<
  Record<AwardCategory, string>
>;

export function collectDraftBallotVotesFromSelectedGameIds(
  selectedGameIdByAwardCategory: SelectedGameIdByAwardCategory,
): BallotVote[] {
  return AWARD_CATEGORIES.flatMap((awardCategory) => {
    const gameId = selectedGameIdByAwardCategory[awardCategory];
    if (gameId === undefined) {
      return [];
    }

    return [{ category: awardCategory, gameId }];
  });
}

export function readSelectedGameIdByAwardCategoryFromBallotVotes(
  votes: BallotVote[],
): SelectedGameIdByAwardCategory {
  const selectedGameIdByAwardCategory: SelectedGameIdByAwardCategory = {};

  for (const vote of votes) {
    selectedGameIdByAwardCategory[vote.category] = vote.gameId;
  }

  return selectedGameIdByAwardCategory;
}

export function isEveryAwardCategoryFilled(
  selectedGameIdByAwardCategory: SelectedGameIdByAwardCategory,
): boolean {
  return AWARD_CATEGORIES.every(
    (awardCategory) => selectedGameIdByAwardCategory[awardCategory] !== undefined,
  );
}

export function countFilledAwardCategories(
  selectedGameIdByAwardCategory: SelectedGameIdByAwardCategory,
): number {
  return AWARD_CATEGORIES.filter(
    (awardCategory) => selectedGameIdByAwardCategory[awardCategory] !== undefined,
  ).length;
}

export function areDraftBallotVoteListsEqual(
  left: BallotVote[],
  right: BallotVote[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((leftVote, index) => {
    const rightVote = right[index];
    return (
      rightVote !== undefined &&
      leftVote.category === rightVote.category &&
      leftVote.gameId === rightVote.gameId
    );
  });
}
