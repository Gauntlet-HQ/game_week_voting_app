import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type pg from "pg";
import { provisionTestPostgres } from "./helpers/provision-test-postgres.js";
import {
  insertCompleteDraftBallot,
  insertGame,
  insertUnlockedBallot,
  insertVote,
  insertVoter,
  resetVotingDatabase
} from "./helpers/voting-test-fixtures.js";

describe("RESTRICT foreign keys never cascade", () => {
  let pool: pg.Pool;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    const postgres = await provisionTestPostgres();
    pool = postgres.pool;
    stop = postgres.stop;
  });

  beforeEach(async () => {
    await resetVotingDatabase(pool);
  });

  afterAll(async () => {
    await stop();
  });

  it("rejects deleting a voter who owns a ballot", async () => {
    const voter = await insertVoter(pool, { displayName: "Ada Lovelace" });
    await insertUnlockedBallot(pool, voter.voterId);

    await expect(
      pool.query(`DELETE FROM voters WHERE voter_id = $1`, [voter.voterId])
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("rejects deleting a ballot that still has votes", async () => {
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
      category: "best_overall",
      gameId: game.gameId
    });

    await expect(
      pool.query(`DELETE FROM ballots WHERE ballot_id = $1`, [ballotId])
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("rejects deleting a game that still has votes", async () => {
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
      category: "best_overall",
      gameId: game.gameId
    });

    await expect(
      pool.query(`DELETE FROM games WHERE game_id = $1`, [game.gameId])
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("rejects deleting a voter who still has vote rows", async () => {
    const voter = await insertVoter(pool, { displayName: "Ada Lovelace" });
    const game = await insertGame(pool, {
      title: "Dungeon Crawler",
      submitterName: "Ada",
      url: "https://example.com/dungeon"
    });
    await insertCompleteDraftBallot(pool, {
      voterId: voter.voterId,
      gameIds: [game.gameId, game.gameId, game.gameId, game.gameId]
    });

    await expect(
      pool.query(`DELETE FROM voters WHERE voter_id = $1`, [voter.voterId])
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("rejects a vote whose voter_id does not match the ballot owner", async () => {
    const owner = await insertVoter(pool, { displayName: "Ada Lovelace" });
    const other = await insertVoter(pool, { displayName: "Grace Hopper" });
    const game = await insertGame(pool, {
      title: "Dungeon Crawler",
      submitterName: "Ada",
      url: "https://example.com/dungeon"
    });
    const ballotId = await insertUnlockedBallot(pool, owner.voterId);

    await expect(
      insertVote(pool, {
        ballotId,
        voterId: other.voterId,
        category: "best_overall",
        gameId: game.gameId
      })
    ).rejects.toThrow(/votes.voter_id must equal ballots.voter_id/);
  });
});
