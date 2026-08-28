import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { provisionTestPostgres } from "./helpers/provision-test-postgres.js";
import {
  buildTestVotingApp,
  createSession,
  insertGame,
  insertUnlockedBallot,
  insertVote,
  insertVoter,
  resetVotingDatabase
} from "./helpers/voting-test-fixtures.js";

describe("name gate and unique (voter_id, category)", () => {
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

  it("rejects session creation when the submitted display name is not on the voter roster", async () => {
    await insertVoter(pool, { displayName: "Ada Lovelace" });

    const unknownName = await createSession(app, {
      displayName: "Grace Hopper"
    });

    expect(unknownName.statusCode).toBe(401);
    expect(unknownName.body.message).toBe(
      "Display name is not on the voter roster"
    );
  });

  it("rejects session creation for an unknown name even when the shared staff password is correct", async () => {
    await insertVoter(pool, { displayName: "Ada Lovelace", isStaff: true });

    const unknownNameWithPassword = await createSession(app, {
      displayName: "Not On Roster",
      staffPassword: "shared-staff-password"
    });

    expect(unknownNameWithPassword.statusCode).toBe(401);
    expect(unknownNameWithPassword.body.message).toBe(
      "Display name is not on the voter roster"
    );
  });

  it("matches roster names case-insensitively and does not create a new voter", async () => {
    const ada = await insertVoter(pool, { displayName: "Ada Lovelace" });

    const session = await createSession(app, { displayName: "ada lovelace" });
    expect(session.statusCode).toBe(200);
    expect(session.body.voterId).toBe(ada.voterId);

    const voterCount = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM voters"
    );
    expect(voterCount.rows[0]?.count).toBe("1");
  });

  it("rejects a second vote row for the same voter_id and award category", async () => {
    const voter = await insertVoter(pool, { displayName: "Ada Lovelace" });
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
    const ballotId = await insertUnlockedBallot(pool, voter.voterId);

    await insertVote(pool, {
      ballotId,
      voterId: voter.voterId,
      category: "technical_achievement",
      gameId: dungeonCrawler.gameId
    });

    await expect(
      insertVote(pool, {
        ballotId,
        voterId: voter.voterId,
        category: "technical_achievement",
        gameId: platformer.gameId
      })
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("allows the same voter to pick one game in each of the four categories", async () => {
    const voter = await insertVoter(pool, { displayName: "Ada Lovelace" });
    const game = await insertGame(pool, {
      title: "Dungeon Crawler",
      submitterName: "Ada",
      url: "https://example.com/dungeon"
    });
    const ballotId = await insertUnlockedBallot(pool, voter.voterId);

    await insertVote(pool, {
      ballotId,
      voterId: voter.voterId,
      category: "technical_achievement",
      gameId: game.gameId
    });
    await insertVote(pool, {
      ballotId,
      voterId: voter.voterId,
      category: "creative_or_fun_gameplay",
      gameId: game.gameId
    });
    await insertVote(pool, {
      ballotId,
      voterId: voter.voterId,
      category: "visuals_or_graphics",
      gameId: game.gameId
    });
    await insertVote(pool, {
      ballotId,
      voterId: voter.voterId,
      category: "best_overall",
      gameId: game.gameId
    });

    const voteCount = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM votes WHERE voter_id = $1",
      [voter.voterId]
    );
    expect(voteCount.rows[0]?.count).toBe("4");
  });
});
