import { vi } from "vitest";
import type { VotingApiClient } from "../api/votingApiTypes";
import {
  emptyUnlockedVoterBallot,
  fourGamesOnTheBallot,
  sealedVoterBallot,
} from "./votingHallTestFixtures";

export function createVotingApiClientMock(
  overrides: Partial<VotingApiClient> = {},
): VotingApiClient {
  return {
    fetchPublicVoterRosterDisplayNames: vi.fn(async () => [
      "Ada Lovelace",
      "Staff Sage",
      "Brannoc",
    ]),
    createHonorSystemSessionWithOptionalSharedStaffPassword: vi.fn(
      async () => ({
        token: "voter-token",
        voterId: "11111111-1111-1111-1111-111111111111",
        displayName: "Ada Lovelace",
        isStaff: false,
      }),
    ),
    fetchGamesListedOnTheBallot: vi.fn(async () => [...fourGamesOnTheBallot]),
    fetchBallotForCurrentVoter: vi.fn(async () => emptyUnlockedVoterBallot),
    replaceUnlockedDraftBallotVotes: vi.fn(async ({ votes }) => ({
      ballotId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
      isLocked: false,
      lockedAt: null,
      votes,
    })),
    lockCompletedBallotForCurrentVoter: vi.fn(async () => sealedVoterBallot),
    ...overrides,
  };
}
