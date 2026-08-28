import { describe, expect, it, vi } from "vitest";
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
});
