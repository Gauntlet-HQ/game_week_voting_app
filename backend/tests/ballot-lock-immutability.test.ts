import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { provisionTestPostgres } from "./helpers/provision-test-postgres.js";
import {
  bearer,
  buildTestVotingApp,
  createSession,
  insertCompleteDraftBallot,
  insertGame,
  insertUnlockedBallot,
  insertVote,
  insertVoter,
  resetVotingDatabase
} from "./helpers/voting-test-fixtures.js";

describe("ballot lock immutability", () => {
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

  it("rejects locking a ballot that does not have all four award categories", async () => {
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

    await expect(
      pool.query(
        `
          UPDATE ballots
          SET is_locked = TRUE, locked_at = now()
          WHERE ballot_id = $1
        `,
        [ballotId]
      )
    ).rejects.toThrow(/cannot lock a ballot without all four award categories/);
  });

  it("rejects unlocking a locked ballot", async () => {
    const voter = await insertVoter(pool, { displayName: "Ada Lovelace" });
    const game = await insertGame(pool, {
      title: "Dungeon Crawler",
      submitterName: "Ada",
      url: "https://example.com/dungeon"
    });
    const ballotId = await insertCompleteDraftBallot(pool, {
      voterId: voter.voterId,
      gameIds: [game.gameId, game.gameId, game.gameId, game.gameId]
    });

    await pool.query(
      `
        UPDATE ballots
        SET is_locked = TRUE, locked_at = now()
        WHERE ballot_id = $1
      `,
      [ballotId]
    );

    await expect(
      pool.query(
        `
          UPDATE ballots
          SET is_locked = FALSE, locked_at = NULL
          WHERE ballot_id = $1
        `,
        [ballotId]
      )
    ).rejects.toThrow(/locked ballots cannot be unlocked/);
  });

  it("freezes vote insert, update, and delete after the ballot is locked", async () => {
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
    const ballotId = await insertCompleteDraftBallot(pool, {
      voterId: voter.voterId,
      gameIds: [
        dungeonCrawler.gameId,
        dungeonCrawler.gameId,
        dungeonCrawler.gameId,
        dungeonCrawler.gameId
      ]
    });

    await pool.query(
      `
        UPDATE ballots
        SET is_locked = TRUE, locked_at = now()
        WHERE ballot_id = $1
      `,
      [ballotId]
    );

    await expect(
      insertVote(pool, {
        ballotId,
        voterId: voter.voterId,
        category: "technical_achievement",
        gameId: platformer.gameId
      })
    ).rejects.toThrow(
      /votes cannot be inserted, updated, or deleted after the ballot is locked/
    );

    await expect(
      pool.query(
        `
          UPDATE votes
          SET game_id = $2, updated_at = now()
          WHERE ballot_id = $1 AND category = 'best_overall'
        `,
        [ballotId, platformer.gameId]
      )
    ).rejects.toThrow(
      /votes cannot be inserted, updated, or deleted after the ballot is locked/
    );

    await expect(
      pool.query(`DELETE FROM votes WHERE ballot_id = $1`, [ballotId])
    ).rejects.toThrow(
      /votes cannot be inserted, updated, or deleted after the ballot is locked/
    );
  });

  it("returns 409 when PUT /ballot is called after the ballot is locked", async () => {
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
    await insertCompleteDraftBallot(pool, {
      voterId: voter.voterId,
      gameIds: [
        dungeonCrawler.gameId,
        dungeonCrawler.gameId,
        dungeonCrawler.gameId,
        dungeonCrawler.gameId
      ]
    });

    const session = await createSession(app, { displayName: "Ada Lovelace" });
    const lockResponse = await app.inject({
      method: "POST",
      url: "/ballot/lock",
      headers: bearer(session.body.token!)
    });
    expect(lockResponse.statusCode).toBe(200);

    const putResponse = await app.inject({
      method: "PUT",
      url: "/ballot",
      headers: bearer(session.body.token!),
      payload: {
        votes: [
          {
            category: "technical_achievement",
            gameId: platformer.gameId
          }
        ]
      }
    });

    expect(putResponse.statusCode).toBe(409);
    expect(putResponse.json().message).toMatch(/locked/i);
  });

  it("rejects POST /ballot/lock when a selected game has been withdrawn", async () => {
    const voter = await insertVoter(pool, { displayName: "Ada Lovelace" });
    const dungeonCrawler = await insertGame(pool, {
      title: "Dungeon Crawler",
      submitterName: "Ada",
      url: "https://example.com/dungeon"
    });
    const withdrawn = await insertGame(pool, {
      title: "Withdrawn Game",
      submitterName: "Grace",
      url: "https://example.com/withdrawn",
      withdrawnFromBallot: true
    });

    const session = await createSession(app, { displayName: "Ada Lovelace" });
    const putResponse = await app.inject({
      method: "PUT",
      url: "/ballot",
      headers: bearer(session.body.token!),
      payload: {
        votes: [
          { category: "technical_achievement", gameId: dungeonCrawler.gameId },
          { category: "creative_or_fun_gameplay", gameId: withdrawn.gameId },
          { category: "visuals_or_graphics", gameId: dungeonCrawler.gameId },
          { category: "best_overall", gameId: dungeonCrawler.gameId }
        ]
      }
    });
    expect(putResponse.statusCode).toBe(400);

    await insertCompleteDraftBallot(pool, {
      voterId: voter.voterId,
      gameIds: [
        dungeonCrawler.gameId,
        withdrawn.gameId,
        dungeonCrawler.gameId,
        dungeonCrawler.gameId
      ]
    });

    const lockResponse = await app.inject({
      method: "POST",
      url: "/ballot/lock",
      headers: bearer(session.body.token!)
    });
    expect(lockResponse.statusCode).toBe(400);
  });
});
