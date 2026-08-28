import { isPlainRecord } from "../isPlainRecord";
import { VotingApiRequestFailedError } from "./VotingApiRequestFailedError";
import {
  isHonorSystemSession,
  type HonorSystemSession,
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
  };
}

async function fetchJsonFromVotingApi(input: {
  fetchImplementation: typeof fetch;
  requestUrl: string;
  requestInit: RequestInit;
  unreachableHallsMessage: string;
}): Promise<unknown> {
  let response: Response;

  try {
    response = await input.fetchImplementation(
      input.requestUrl,
      input.requestInit,
    );
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
