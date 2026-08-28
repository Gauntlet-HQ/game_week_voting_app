import { describe, expect, it } from "vitest";
import { readVotingApiBaseUrl } from "./readVotingApiBaseUrl";

describe("readVotingApiBaseUrl", () => {
  it("defaults to the local Fastify hall when no Vite base URL is configured", () => {
    expect(readVotingApiBaseUrl({})).toBe("http://localhost:3000");
  });

  it("uses VITE_API_BASE_URL and strips a trailing slash", () => {
    expect(
      readVotingApiBaseUrl({
        VITE_API_BASE_URL: "https://voting.example.test/api/",
      }),
    ).toBe("https://voting.example.test/api");
  });
});
