export function describeLockedBallotCount(lockedBallotCount: number): string {
  if (lockedBallotCount === 1) {
    return "1 sealed ballot has been counted.";
  }

  return `${lockedBallotCount} sealed ballots have been counted.`;
}

export const noSealedVotesInThisHallMessage =
  "No sealed votes have been tallied in this hall yet.";

export function describeStaffResultsStandingCaption(standing: {
  rank: number;
  voteCount: number;
  isTied: boolean;
}): string {
  const voteNoun = standing.voteCount === 1 ? "vote" : "votes";
  const captionParts = [
    `Rank ${standing.rank}`,
    `${standing.voteCount} ${voteNoun}`,
  ];

  if (standing.rank === 1) {
    captionParts.push(standing.isTied ? "Tied winner" : "Winner");
  } else if (standing.isTied) {
    captionParts.push("Tied");
  }

  return captionParts.join(" · ");
}
