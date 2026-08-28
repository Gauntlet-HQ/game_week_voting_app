import { describe, expect, it } from "vitest";
import {
  areDraftBallotVoteListsEqual,
  collectDraftBallotVotesFromSelectedGameIds,
  countFilledAwardCategories,
  isEveryAwardCategoryFilled,
  readSelectedGameIdByAwardCategoryFromBallotVotes,
} from "./draftBallotSelections";

const dungeonCrawlerGameId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1";
const lanternsGameId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2";
const riftGameId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3";
const stormsGameId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4";

describe("draftBallotSelections", () => {
  it("omits unfilled halls from the PUT body so a partial draft can be saved", () => {
    expect(
      collectDraftBallotVotesFromSelectedGameIds({
        technical_achievement: dungeonCrawlerGameId,
        best_overall: stormsGameId,
      }),
    ).toEqual([
      { category: "technical_achievement", gameId: dungeonCrawlerGameId },
      { category: "best_overall", gameId: stormsGameId },
    ]);
  });

  it("blocks lock-in until every award category has a game", () => {
    const incompleteSelection = {
      technical_achievement: dungeonCrawlerGameId,
      creative_or_fun_gameplay: lanternsGameId,
      visuals_or_graphics: riftGameId,
    };

    expect(isEveryAwardCategoryFilled(incompleteSelection)).toBe(false);
    expect(countFilledAwardCategories(incompleteSelection)).toBe(3);

    const completeSelection = {
      ...incompleteSelection,
      best_overall: stormsGameId,
    };

    expect(isEveryAwardCategoryFilled(completeSelection)).toBe(true);
    expect(countFilledAwardCategories(completeSelection)).toBe(4);
  });

  it("compares PUT bodies so a stale draft save cannot clobber a newer pick", () => {
    expect(
      areDraftBallotVoteListsEqual(
        [{ category: "best_overall", gameId: stormsGameId }],
        [{ category: "best_overall", gameId: stormsGameId }],
      ),
    ).toBe(true);
    expect(
      areDraftBallotVoteListsEqual(
        [{ category: "best_overall", gameId: stormsGameId }],
        [
          { category: "technical_achievement", gameId: dungeonCrawlerGameId },
          { category: "best_overall", gameId: stormsGameId },
        ],
      ),
    ).toBe(false);
  });

  it("restores the character-select map from GET /ballot votes", () => {
    expect(
      readSelectedGameIdByAwardCategoryFromBallotVotes([
        { category: "visuals_or_graphics", gameId: riftGameId },
        { category: "technical_achievement", gameId: dungeonCrawlerGameId },
      ]),
    ).toEqual({
      technical_achievement: dungeonCrawlerGameId,
      visuals_or_graphics: riftGameId,
    });
  });
});
