import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { AWARD_CATEGORIES } from "../src/award-categories.js";
import { provisionTestPostgres } from "./helpers/provision-test-postgres.js";
import {
  bearer,
  buildTestVotingApp,
  createSession,
  insertCompleteDraftBallot,
  insertGame,
  insertVoter,
  resetVotingDatabase,
  TEST_STAFF_PASSWORD
} from "./helpers/voting-test-fixtures.js";

describe("results ignore draft ballots", () => {
  let pool: pg.Pool;
  let stop: () => Promise<void>;
  let app: FastifyInstance;

  beforeAll(async () => {
    const postgres = await provisionTestPostgres();
    pool = postgres.pool;
    stop = postgres.stop;
    app = await buildTestVotingApp(pool);
  });

  beforeEach(async () => {
    await resetVotingDatabase(pool);
  });

  afterAll(async () => {
    await app.close();
    await stop();
  });

  it("counts only locked ballots and makes equal vote totals visible as ties", async () => {
    const staff = await insertVoter(pool, {
      displayName: "Staff Sage",
      isStaff: true
    });
    const draftVoter = await insertVoter(pool, { displayName: "Draft Voter" });
    const lockedVoterOne = await insertVoter(pool, {
      displayName: "Locked One"
    });
    const lockedVoterTwo = await insertVoter(pool, {
      displayName: "Locked Two"
    });

    const dungeonCrawler = await insertGame(pool, {
      title: "Dungeon Crawler",
      submitterName: "Ada",
      url: "https://example.com/dungeon"
    });
    const platformer = await insertGame(pool, {
      title: "Platformer",
      submitterName: "Grace",
      url: "https://example.com/platformer"
    });
    const visualNovel = await insertGame(pool, {
      title: "Visual Novel",
      submitterName: "Alan",
      url: "https://example.com/vn"
    });

    await insertCompleteDraftBallot(pool, {
      voterId: draftVoter.voterId,
      gameIds: [
        visualNovel.gameId,
        visualNovel.gameId,
        visualNovel.gameId,
        visualNovel.gameId
      ]
    });

    const lockedOneBallotId = await insertCompleteDraftBallot(pool, {
      voterId: lockedVoterOne.voterId,
      gameIds: [
        dungeonCrawler.gameId,
        dungeonCrawler.gameId,
        dungeonCrawler.gameId,
        dungeonCrawler.gameId
      ]
    });
    const lockedTwoBallotId = await insertCompleteDraftBallot(pool, {
      voterId: lockedVoterTwo.voterId,
      gameIds: [
        platformer.gameId,
        platformer.gameId,
        platformer.gameId,
        platformer.gameId
      ]
    });

    await pool.query(
      `
        UPDATE ballots
        SET is_locked = TRUE, locked_at = now()
        WHERE ballot_id = ANY($1::uuid[])
      `,
      [[lockedOneBallotId, lockedTwoBallotId]]
    );

    const staffSession = await createSession(app, {
      displayName: staff.displayName,
      staffPassword: TEST_STAFF_PASSWORD
    });

    const response = await app.inject({
      method: "GET",
      url: "/staff/results",
      headers: bearer(staffSession.body.token!)
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      lockedBallotCount: number;
      categories: Array<{
        category: string;
        standings: Array<{
          rank: number;
          voteCount: number;
          isTied: boolean;
          game: { title: string };
        }>;
      }>;
    };

    expect(body.lockedBallotCount).toBe(2);
    expect(body.categories.map((category) => category.category)).toEqual([
      ...AWARD_CATEGORIES
    ]);

    for (const category of body.categories) {
      expect(category.standings).toHaveLength(2);
      expect(category.standings.map((row) => row.game.title).sort()).toEqual([
        "Dungeon Crawler",
        "Platformer"
      ]);
      expect(category.standings.every((row) => row.voteCount === 1)).toBe(true);
      expect(category.standings.every((row) => row.rank === 1)).toBe(true);
      expect(category.standings.every((row) => row.isTied)).toBe(true);
      expect(
        category.standings.some((row) => row.game.title === "Visual Novel")
      ).toBe(false);
    }
  });
});
