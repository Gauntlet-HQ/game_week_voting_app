import { describe, expect, it, vi } from "vitest";
import {
  completeUnlockedVoterBallot,
  dungeonCrawlerGame,
  fourGamesOnTheBallot,
  lanternsOfQeynosGame,
  sealedVoterBallot,
} from "../test/votingHallTestFixtures";
import { createVotingApiClient } from "./createVotingApiClient";
import { VotingApiRequestFailedError } from "./VotingApiRequestFailedError";

const apiBaseUrl = "http://voting.example.test";

function createJsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createVotingApiClient", () => {
  it("loads public roster display names from GET /voters and ignores extra fields", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async (requestUrl) => {
      expect(String(requestUrl)).toBe(`${apiBaseUrl}/voters`);
      return createJsonResponse(200, {
        voters: [
          { displayName: "Ada Lovelace", isStaff: true },
          { displayName: "Brannoc" },
        ],
      });
    });

    const votingApiClient = createVotingApiClient({
      fetchImplementation,
      apiBaseUrl,
    });

    await expect(
      votingApiClient.fetchPublicVoterRosterDisplayNames(),
    ).resolves.toEqual(["Ada Lovelace", "Brannoc"]);
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });

  it("creates an honor-system session without sending a staff password when the field is empty", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(
      async (requestUrl, requestInit) => {
        expect(String(requestUrl)).toBe(`${apiBaseUrl}/sessions`);
        expect(requestInit?.method).toBe("POST");
        expect(JSON.parse(String(requestInit?.body))).toEqual({
          displayName: "Ada Lovelace",
        });
        return createJsonResponse(200, {
          token: "session-token",
          voterId: "11111111-1111-1111-1111-111111111111",
          displayName: "Ada Lovelace",
          isStaff: false,
        });
      },
    );

    const votingApiClient = createVotingApiClient({
      fetchImplementation,
      apiBaseUrl,
    });

    await expect(
      votingApiClient.createHonorSystemSessionWithOptionalSharedStaffPassword({
        displayName: "Ada Lovelace",
        sharedStaffPassword: "",
      }),
    ).resolves.toEqual({
      token: "session-token",
      voterId: "11111111-1111-1111-1111-111111111111",
      displayName: "Ada Lovelace",
      isStaff: false,
    });
  });

  it("sends the shared staff password on POST /sessions when it is provided", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(
      async (_requestUrl, requestInit) => {
        expect(JSON.parse(String(requestInit?.body))).toEqual({
          displayName: "Staff Sage",
          staffPassword: "guild-seal",
        });
        return createJsonResponse(200, {
          token: "staff-token",
          voterId: "22222222-2222-2222-2222-222222222222",
          displayName: "Staff Sage",
          isStaff: true,
        });
      },
    );

    const votingApiClient = createVotingApiClient({
      fetchImplementation,
      apiBaseUrl,
    });

    await expect(
      votingApiClient.createHonorSystemSessionWithOptionalSharedStaffPassword({
        displayName: "Staff Sage",
        sharedStaffPassword: "guild-seal",
      }),
    ).resolves.toMatchObject({ isStaff: true, displayName: "Staff Sage" });
  });

  it("surfaces an unknown-name 401 without inventing a roster", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      createJsonResponse(401, {
        message: "Display name is not on the voter roster",
      }),
    );

    const votingApiClient = createVotingApiClient({
      fetchImplementation,
      apiBaseUrl,
    });

    const sessionError = await votingApiClient
      .createHonorSystemSessionWithOptionalSharedStaffPassword({
        displayName: "Not On Roster",
        sharedStaffPassword: "",
      })
      .catch((error: unknown) => error);

    expect(sessionError).toBeInstanceOf(VotingApiRequestFailedError);
    expect(sessionError).toMatchObject({
      failureKind: "http",
      httpStatusCode: 401,
      message: "Display name is not on the voter roster",
    });
  });

  it("marks a refused roster fetch as a network failure", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });

    const votingApiClient = createVotingApiClient({
      fetchImplementation,
      apiBaseUrl,
    });

    const rosterError = await votingApiClient
      .fetchPublicVoterRosterDisplayNames()
      .catch((error: unknown) => error);

    expect(rosterError).toBeInstanceOf(VotingApiRequestFailedError);
    expect(rosterError).toMatchObject({
      failureKind: "network",
      message:
        "The guild roster could not be summoned. The halls are unreachable.",
    });
  });

  it("loads games from GET /games with the session bearer token", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(
      async (requestUrl, requestInit) => {
        expect(String(requestUrl)).toBe(`${apiBaseUrl}/games`);
        expect(requestInit?.method).toBe("GET");
        expect(readAuthorizationHeader(requestInit)).toBe(
          "Bearer session-token",
        );
        return createJsonResponse(200, { games: fourGamesOnTheBallot });
      },
    );

    const votingApiClient = createVotingApiClient({
      fetchImplementation,
      apiBaseUrl,
    });

    await expect(
      votingApiClient.fetchGamesListedOnTheBallot({
        sessionToken: "session-token",
      }),
    ).resolves.toEqual(fourGamesOnTheBallot);
  });

  it("loads the current ballot from GET /ballot with the session bearer token", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(
      async (requestUrl, requestInit) => {
        expect(String(requestUrl)).toBe(`${apiBaseUrl}/ballot`);
        expect(readAuthorizationHeader(requestInit)).toBe(
          "Bearer session-token",
        );
        return createJsonResponse(200, completeUnlockedVoterBallot);
      },
    );

    const votingApiClient = createVotingApiClient({
      fetchImplementation,
      apiBaseUrl,
    });

    await expect(
      votingApiClient.fetchBallotForCurrentVoter({
        sessionToken: "session-token",
      }),
    ).resolves.toEqual(completeUnlockedVoterBallot);
  });

  it("replaces an unlocked draft with PUT /ballot until the ballot is locked", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(
      async (requestUrl, requestInit) => {
        expect(String(requestUrl)).toBe(`${apiBaseUrl}/ballot`);
        expect(requestInit?.method).toBe("PUT");
        expect(readAuthorizationHeader(requestInit)).toBe(
          "Bearer session-token",
        );
        expect(JSON.parse(String(requestInit?.body))).toEqual({
          votes: [
            {
              category: "technical_achievement",
              gameId: dungeonCrawlerGame.gameId,
            },
          ],
        });
        return createJsonResponse(200, {
          ballotId: completeUnlockedVoterBallot.ballotId,
          isLocked: false,
          lockedAt: null,
          votes: [
            {
              category: "technical_achievement",
              gameId: dungeonCrawlerGame.gameId,
            },
          ],
        });
      },
    );

    const votingApiClient = createVotingApiClient({
      fetchImplementation,
      apiBaseUrl,
    });

    await expect(
      votingApiClient.replaceUnlockedDraftBallotVotes({
        sessionToken: "session-token",
        votes: [
          {
            category: "technical_achievement",
            gameId: dungeonCrawlerGame.gameId,
          },
        ],
      }),
    ).resolves.toMatchObject({ isLocked: false });
  });

  it("refuses PUT /ballot with 409 when the ballot is already sealed", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      createJsonResponse(409, {
        message: "Ballot is locked and cannot be changed",
      }),
    );

    const votingApiClient = createVotingApiClient({
      fetchImplementation,
      apiBaseUrl,
    });

    const lockedError = await votingApiClient
      .replaceUnlockedDraftBallotVotes({
        sessionToken: "session-token",
        votes: completeUnlockedVoterBallot.votes,
      })
      .catch((error: unknown) => error);

    expect(lockedError).toBeInstanceOf(VotingApiRequestFailedError);
    expect(lockedError).toMatchObject({
      failureKind: "http",
      httpStatusCode: 409,
      message: "Ballot is locked and cannot be changed",
    });
  });

  it("seals a complete ballot with POST /ballot/lock", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(
      async (requestUrl, requestInit) => {
        expect(String(requestUrl)).toBe(`${apiBaseUrl}/ballot/lock`);
        expect(requestInit?.method).toBe("POST");
        expect(readAuthorizationHeader(requestInit)).toBe(
          "Bearer session-token",
        );
        return createJsonResponse(200, sealedVoterBallot);
      },
    );

    const votingApiClient = createVotingApiClient({
      fetchImplementation,
      apiBaseUrl,
    });

    await expect(
      votingApiClient.lockCompletedBallotForCurrentVoter({
        sessionToken: "session-token",
      }),
    ).resolves.toEqual(sealedVoterBallot);
  });

  it("surfaces a 400 when locking an incomplete ballot", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      createJsonResponse(400, {
        message:
          "Locking a ballot requires one real non-withdrawn game in each of the four award categories",
      }),
    );

    const votingApiClient = createVotingApiClient({
      fetchImplementation,
      apiBaseUrl,
    });

    const incompleteLockError = await votingApiClient
      .lockCompletedBallotForCurrentVoter({
        sessionToken: "session-token",
      })
      .catch((error: unknown) => error);

    expect(incompleteLockError).toBeInstanceOf(VotingApiRequestFailedError);
    expect(incompleteLockError).toMatchObject({
      failureKind: "http",
      httpStatusCode: 400,
    });
  });

  it("posts games CSV as a raw text/csv body to POST /staff/games/import", async () => {
    const gamesCsvText = [
      "title,submitter_name,url",
      "Dungeon Crawler,Ada Lovelace,https://example.com/dungeon",
    ].join("\n");
    const fetchImplementation = vi.fn<typeof fetch>(
      async (requestUrl, requestInit) => {
        expect(String(requestUrl)).toBe(`${apiBaseUrl}/staff/games/import`);
        expect(requestInit?.method).toBe("POST");
        expect(readContentTypeHeader(requestInit)).toBe("text/csv");
        expect(requestInit?.body).toBe(gamesCsvText);
        expect(readAuthorizationHeader(requestInit)).toBe("Bearer staff-token");
        return createJsonResponse(200, {
          upserted: 1,
          deleted: 0,
          withdrawn: 0,
        });
      },
    );

    const votingApiClient = createVotingApiClient({
      fetchImplementation,
      apiBaseUrl,
    });

    await expect(
      votingApiClient.importGamesFromCsvText({
        sessionToken: "staff-token",
        csvText: gamesCsvText,
      }),
    ).resolves.toEqual({
      upserted: 1,
      deleted: 0,
      withdrawn: 0,
    });
  });

  it("surfaces games CSV row errors from a 400 on POST /staff/games/import", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      createJsonResponse(400, {
        message: "Games CSV row 2 has a blank title, submitter_name, or url",
      }),
    );

    const votingApiClient = createVotingApiClient({
      fetchImplementation,
      apiBaseUrl,
    });

    const gamesImportError = await votingApiClient
      .importGamesFromCsvText({
        sessionToken: "staff-token",
        csvText: "title,submitter_name,url\n,,https://example.com/blank",
      })
      .catch((error: unknown) => error);

    expect(gamesImportError).toBeInstanceOf(VotingApiRequestFailedError);
    expect(gamesImportError).toMatchObject({
      failureKind: "http",
      httpStatusCode: 400,
      message: "Games CSV row 2 has a blank title, submitter_name, or url",
    });
  });

  it("posts roster CSV as a raw text/csv body to POST /staff/voters/import", async () => {
    const rosterCsvText = [
      "display_name,is_staff",
      "Ada Lovelace,false",
      "Staff Sage,true",
    ].join("\n");
    const fetchImplementation = vi.fn<typeof fetch>(
      async (requestUrl, requestInit) => {
        expect(String(requestUrl)).toBe(`${apiBaseUrl}/staff/voters/import`);
        expect(requestInit?.method).toBe("POST");
        expect(readContentTypeHeader(requestInit)).toBe("text/csv");
        expect(requestInit?.body).toBe(rosterCsvText);
        expect(readAuthorizationHeader(requestInit)).toBe("Bearer staff-token");
        return createJsonResponse(200, {
          upserted: 2,
          deleted: 0,
          keptBecauseBallotExists: 0,
        });
      },
    );

    const votingApiClient = createVotingApiClient({
      fetchImplementation,
      apiBaseUrl,
    });

    await expect(
      votingApiClient.importVoterRosterFromCsvText({
        sessionToken: "staff-token",
        csvText: rosterCsvText,
      }),
    ).resolves.toEqual({
      upserted: 2,
      deleted: 0,
      keptBecauseBallotExists: 0,
    });
  });

  it("surfaces roster CSV row errors from a 400 on POST /staff/voters/import", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      createJsonResponse(400, {
        message: "Voter roster CSV row 2 has a blank display_name",
      }),
    );

    const votingApiClient = createVotingApiClient({
      fetchImplementation,
      apiBaseUrl,
    });

    const rosterImportError = await votingApiClient
      .importVoterRosterFromCsvText({
        sessionToken: "staff-token",
        csvText: "display_name,is_staff\n,true",
      })
      .catch((error: unknown) => error);

    expect(rosterImportError).toBeInstanceOf(VotingApiRequestFailedError);
    expect(rosterImportError).toMatchObject({
      failureKind: "http",
      httpStatusCode: 400,
      message: "Voter roster CSV row 2 has a blank display_name",
    });
  });

  it("loads locked-ballot results from GET /staff/results with the staff bearer token", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(
      async (requestUrl, requestInit) => {
        expect(String(requestUrl)).toBe(`${apiBaseUrl}/staff/results`);
        expect(requestInit?.method).toBe("GET");
        expect(readAuthorizationHeader(requestInit)).toBe("Bearer staff-token");
        return createJsonResponse(200, {
          lockedBallotCount: 2,
          categories: [
            {
              category: "technical_achievement",
              standings: [
                {
                  rank: 1,
                  voteCount: 2,
                  isTied: false,
                  game: dungeonCrawlerGame,
                },
              ],
            },
          ],
        });
      },
    );

    const votingApiClient = createVotingApiClient({
      fetchImplementation,
      apiBaseUrl,
    });

    await expect(
      votingApiClient.fetchLockedBallotResultsForStaff({
        sessionToken: "staff-token",
      }),
    ).resolves.toMatchObject({
      lockedBallotCount: 2,
      categories: [
        {
          category: "technical_achievement",
          standings: [
            {
              rank: 1,
              voteCount: 2,
              isTied: false,
              game: dungeonCrawlerGame,
            },
          ],
        },
      ],
    });
  });

  it("surfaces 403 when a voter token tries to read staff results", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      createJsonResponse(403, {
        message: "Staff authorization is required",
      }),
    );

    const votingApiClient = createVotingApiClient({
      fetchImplementation,
      apiBaseUrl,
    });

    const staffForbiddenError = await votingApiClient
      .fetchLockedBallotResultsForStaff({
        sessionToken: "voter-token",
      })
      .catch((error: unknown) => error);

    expect(staffForbiddenError).toBeInstanceOf(VotingApiRequestFailedError);
    expect(staffForbiddenError).toMatchObject({
      failureKind: "http",
      httpStatusCode: 403,
      message: "Staff authorization is required",
    });
  });

  it("does not invent games when GET /games is malformed", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      createJsonResponse(200, {
        games: [{ title: lanternsOfQeynosGame.title }],
      }),
    );

    const votingApiClient = createVotingApiClient({
      fetchImplementation,
      apiBaseUrl,
    });

    const gamesError = await votingApiClient
      .fetchGamesListedOnTheBallot({ sessionToken: "session-token" })
      .catch((error: unknown) => error);

    expect(gamesError).toBeInstanceOf(VotingApiRequestFailedError);
    expect(gamesError).toMatchObject({
      message: "The halls returned an unreadable list of games.",
    });
  });
});

function readAuthorizationHeader(
  requestInit: RequestInit | undefined,
): string | null {
  return new Headers(requestInit?.headers).get("Authorization");
}

function readContentTypeHeader(
  requestInit: RequestInit | undefined,
): string | null {
  return new Headers(requestInit?.headers).get("Content-Type");
}
