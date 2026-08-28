import { isPlainRecord } from "../isPlainRecord";
import { VotingApiRequestFailedError } from "./VotingApiRequestFailedError";
import {
  isGameListedOnTheBallot,
  isGamesCsvImportSummary,
  isHonorSystemSession,
  isStaffLockedBallotResults,
  isVoterBallot,
  isVoterRosterCsvImportSummary,
  type GameListedOnTheBallot,
  type GamesCsvImportSummary,
  type HonorSystemSession,
  type StaffLockedBallotResults,
  type VoterBallot,
  type VoterRosterCsvImportSummary,
  type VotingApiClient,
} from "./votingApiTypes";

export function createVotingApiClient(input: {
  fetchImplementation: typeof fetch;
  apiBaseUrl: string;
}): VotingApiClient {
  const apiBaseUrl = input.apiBaseUrl.replace(/\/$/, "");

  return {
    fetchPublicVoterRosterDisplayNames: async () => {
      const responseBody = await fetchJsonFromVotingApi({
        fetchImplementation: input.fetchImplementation,
        requestUrl: `${apiBaseUrl}/voters`,
        requestInit: {
          method: "GET",
        },
        unreachableHallsMessage:
          "The guild roster could not be summoned. The halls are unreachable.",
      });

      return readDisplayNamesFromPublicRosterResponse(responseBody);
    },
    createHonorSystemSessionWithOptionalSharedStaffPassword: async ({
      displayName,
      sharedStaffPassword,
    }) => {
      const requestBody: {
        displayName: string;
        staffPassword?: string;
      } = { displayName };

      if (sharedStaffPassword.length > 0) {
        requestBody.staffPassword = sharedStaffPassword;
      }

      const responseBody = await fetchJsonFromVotingApi({
        fetchImplementation: input.fetchImplementation,
        requestUrl: `${apiBaseUrl}/sessions`,
        requestInit: {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
        unreachableHallsMessage:
          "The gatekeepers could not hear your name. The halls are unreachable.",
      });

      return readHonorSystemSessionFromResponse(responseBody);
    },
    fetchGamesListedOnTheBallot: async ({ sessionToken }) => {
      const responseBody = await fetchJsonFromVotingApi({
        fetchImplementation: input.fetchImplementation,
        requestUrl: `${apiBaseUrl}/games`,
        requestInit: {
          method: "GET",
        },
        sessionToken,
        unreachableHallsMessage:
          "The games could not be summoned. The halls are unreachable.",
      });

      return readGamesListedOnTheBallotFromResponse(responseBody);
    },
    fetchBallotForCurrentVoter: async ({ sessionToken }) => {
      const responseBody = await fetchJsonFromVotingApi({
        fetchImplementation: input.fetchImplementation,
        requestUrl: `${apiBaseUrl}/ballot`,
        requestInit: {
          method: "GET",
        },
        sessionToken,
        unreachableHallsMessage:
          "The ballot could not be summoned. The halls are unreachable.",
      });

      return readVoterBallotFromResponse(responseBody);
    },
    replaceUnlockedDraftBallotVotes: async ({ sessionToken, votes }) => {
      const responseBody = await fetchJsonFromVotingApi({
        fetchImplementation: input.fetchImplementation,
        requestUrl: `${apiBaseUrl}/ballot`,
        requestInit: {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ votes }),
        },
        sessionToken,
        unreachableHallsMessage:
          "The ballot draft could not be saved. The halls are unreachable.",
      });

      return readVoterBallotFromResponse(responseBody);
    },
    lockCompletedBallotForCurrentVoter: async ({ sessionToken }) => {
      const responseBody = await fetchJsonFromVotingApi({
        fetchImplementation: input.fetchImplementation,
        requestUrl: `${apiBaseUrl}/ballot/lock`,
        requestInit: {
          method: "POST",
        },
        sessionToken,
        unreachableHallsMessage:
          "The ballot could not be sealed. The halls are unreachable.",
      });

      return readVoterBallotFromResponse(responseBody);
    },
    importGamesFromCsvText: async ({ sessionToken, csvText }) => {
      const responseBody = await fetchJsonFromVotingApi({
        fetchImplementation: input.fetchImplementation,
        requestUrl: `${apiBaseUrl}/staff/games/import`,
        requestInit: {
          method: "POST",
          headers: {
            "Content-Type": "text/csv",
          },
          body: csvText,
        },
        sessionToken,
        unreachableHallsMessage:
          "The games ledger could not be inscribed. The halls are unreachable.",
      });

      return readGamesCsvImportSummaryFromResponse(responseBody);
    },
    importVoterRosterFromCsvText: async ({ sessionToken, csvText }) => {
      const responseBody = await fetchJsonFromVotingApi({
        fetchImplementation: input.fetchImplementation,
        requestUrl: `${apiBaseUrl}/staff/voters/import`,
        requestInit: {
          method: "POST",
          headers: {
            "Content-Type": "text/csv",
          },
          body: csvText,
        },
        sessionToken,
        unreachableHallsMessage:
          "The roster ledger could not be inscribed. The halls are unreachable.",
      });

      return readVoterRosterCsvImportSummaryFromResponse(responseBody);
    },
    fetchLockedBallotResultsForStaff: async ({ sessionToken }) => {
      const responseBody = await fetchJsonFromVotingApi({
        fetchImplementation: input.fetchImplementation,
        requestUrl: `${apiBaseUrl}/staff/results`,
        requestInit: {
          method: "GET",
        },
        sessionToken,
        unreachableHallsMessage:
          "The sealed results could not be summoned. The halls are unreachable.",
      });

      return readStaffLockedBallotResultsFromResponse(responseBody);
    },
  };
}

async function fetchJsonFromVotingApi(input: {
  fetchImplementation: typeof fetch;
  requestUrl: string;
  requestInit: RequestInit;
  unreachableHallsMessage: string;
  sessionToken?: string;
}): Promise<unknown> {
  const headers = new Headers(input.requestInit.headers);

  if (input.sessionToken !== undefined && input.sessionToken.length > 0) {
    headers.set("Authorization", `Bearer ${input.sessionToken}`);
  }

  let response: Response;

  try {
    response = await input.fetchImplementation(input.requestUrl, {
      ...input.requestInit,
      headers,
    });
  } catch {
    throw new VotingApiRequestFailedError({
      failureKind: "network",
      message: input.unreachableHallsMessage,
    });
  }

  const responseBody = await readJsonBodyFromResponse(response);

  if (!response.ok) {
    throw new VotingApiRequestFailedError({
      failureKind: "http",
      httpStatusCode: response.status,
      message: readApiErrorMessageFromUnknownBody(responseBody),
    });
  }

  return responseBody;
}

async function readJsonBodyFromResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function readApiErrorMessageFromUnknownBody(responseBody: unknown): string {
  if (
    isPlainRecord(responseBody) &&
    typeof responseBody.message === "string" &&
    responseBody.message.length > 0
  ) {
    return responseBody.message;
  }

  return "The guild halls refused the request.";
}

function readDisplayNamesFromPublicRosterResponse(
  responseBody: unknown,
): string[] {
  if (!isPlainRecord(responseBody) || !Array.isArray(responseBody.voters)) {
    throw new VotingApiRequestFailedError({
      failureKind: "http",
      message: "The guild roster response was not a list of names.",
    });
  }

  return responseBody.voters.map((voterEntry) => {
    if (
      !isPlainRecord(voterEntry) ||
      typeof voterEntry.displayName !== "string" ||
      voterEntry.displayName.length === 0
    ) {
      throw new VotingApiRequestFailedError({
        failureKind: "http",
        message: "The guild roster response was not a list of names.",
      });
    }

    return voterEntry.displayName;
  });
}

function readHonorSystemSessionFromResponse(
  responseBody: unknown,
): HonorSystemSession {
  if (!isHonorSystemSession(responseBody)) {
    throw new VotingApiRequestFailedError({
      failureKind: "http",
      message: "The gatekeepers returned an unreadable session.",
    });
  }

  return responseBody;
}

function readGamesListedOnTheBallotFromResponse(
  responseBody: unknown,
): GameListedOnTheBallot[] {
  if (!isPlainRecord(responseBody) || !Array.isArray(responseBody.games)) {
    throw new VotingApiRequestFailedError({
      failureKind: "http",
      message: "The halls returned an unreadable list of games.",
    });
  }

  return responseBody.games.map((gameEntry) => {
    if (!isGameListedOnTheBallot(gameEntry)) {
      throw new VotingApiRequestFailedError({
        failureKind: "http",
        message: "The halls returned an unreadable list of games.",
      });
    }

    return gameEntry;
  });
}

function readVoterBallotFromResponse(responseBody: unknown): VoterBallot {
  if (!isVoterBallot(responseBody)) {
    throw new VotingApiRequestFailedError({
      failureKind: "http",
      message: "The halls returned an unreadable ballot.",
    });
  }

  return responseBody;
}

function readGamesCsvImportSummaryFromResponse(
  responseBody: unknown,
): GamesCsvImportSummary {
  if (!isGamesCsvImportSummary(responseBody)) {
    throw new VotingApiRequestFailedError({
      failureKind: "http",
      message: "The halls returned an unreadable games ledger summary.",
    });
  }

  return responseBody;
}

function readVoterRosterCsvImportSummaryFromResponse(
  responseBody: unknown,
): VoterRosterCsvImportSummary {
  if (!isVoterRosterCsvImportSummary(responseBody)) {
    throw new VotingApiRequestFailedError({
      failureKind: "http",
      message: "The halls returned an unreadable roster ledger summary.",
    });
  }

  return responseBody;
}

function readStaffLockedBallotResultsFromResponse(
  responseBody: unknown,
): StaffLockedBallotResults {
  if (!isStaffLockedBallotResults(responseBody)) {
    throw new VotingApiRequestFailedError({
      failureKind: "http",
      message: "The halls returned unreadable sealed results.",
    });
  }

  return responseBody;
}
