import { describe, expect, it } from "vitest";
import {
  describeLockedBallotCount,
  describeStaffResultsStandingCaption,
} from "./describeStaffResultsCopy";

describe("describeStaffResultsCopy", () => {
  it("names a single sealed ballot in the singular", () => {
    expect(describeLockedBallotCount(1)).toBe(
      "1 sealed ballot has been counted.",
    );
  });

  it("names several sealed ballots in the plural, including zero", () => {
    expect(describeLockedBallotCount(0)).toBe(
      "0 sealed ballots have been counted.",
    );
    expect(describeLockedBallotCount(2)).toBe(
      "2 sealed ballots have been counted.",
    );
  });

  it("marks an untied first-place standing as the winner with its vote count", () => {
    expect(
      describeStaffResultsStandingCaption({
        rank: 1,
        voteCount: 2,
        isTied: false,
      }),
    ).toBe("Rank 1 · 2 votes · Winner");
  });

  it("marks tied first-place standings as tied winners", () => {
    expect(
      describeStaffResultsStandingCaption({
        rank: 1,
        voteCount: 1,
        isTied: true,
      }),
    ).toBe("Rank 1 · 1 vote · Tied winner");
  });

  it("does not call a lower-rank standing a winner, even when that rank is tied", () => {
    expect(
      describeStaffResultsStandingCaption({
        rank: 2,
        voteCount: 3,
        isTied: true,
      }),
    ).toBe("Rank 2 · 3 votes · Tied");
  });
});
