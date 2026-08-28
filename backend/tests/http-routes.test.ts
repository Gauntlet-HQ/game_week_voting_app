import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { AWARD_CATEGORIES } from "../src/award-categories.js";
import { provisionTestPostgres } from "./helpers/provision-test-postgres.js";
import {
  bearer,
  buildTestVotingApp,
  createSession,
  insertGame,
  insertVoter,
  resetVotingDatabase
} from "./helpers/voting-test-fixtures.js";

describe("HTTP ballot and catalog routes", () => {
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

  it("lists roster names only and omits withdrawn games from GET /games", async () => {
    await insertVoter(pool, { displayName: "Ada Lovelace", isStaff: true });
    await insertVoter(pool, { displayName: "Grace Hopper" });
    const active = await insertGame(pool, {
      title: "Dungeon Crawler",
      submitterName: "Ada",
      url: "https://example.com/dungeon"
    });
    await insertGame(pool, {
      title: "Withdrawn Game",
      submitterName: "Grace",
      url: "https://example.com/withdrawn",
      withdrawnFromBallot: true
    });

    const voters = await app.inject({ method: "GET", url: "/voters" });
    expect(voters.statusCode).toBe(200);
    expect(voters.json()).toEqual({
      voters: [{ displayName: "Ada Lovelace" }, { displayName: "Grace Hopper" }]
    });
    expect(JSON.stringify(voters.json())).not.toMatch(/isStaff|voterId|is_staff/);

    const session = await createSession(app, { displayName: "Grace Hopper" });
    const games = await app.inject({
      method: "GET",
      url: "/games",
      headers: bearer(session.body.token!)
    });
    expect(games.statusCode).toBe(200);
    expect(games.json()).toEqual({
      games: [
        {
          gameId: active.gameId,
          title: "Dungeon Crawler",
          submitterName: "Ada",
          url: "https://example.com/dungeon"
        }
      ]
    });
  });

  it("saves a draft ballot, locks when all four categories are filled, then freezes it", async () => {
    await insertVoter(pool, { displayName: "Ada Lovelace" });
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

    const session = await createSession(app, { displayName: "Ada Lovelace" });
    const headers = bearer(session.body.token!);

    const empty = await app.inject({ method: "GET", url: "/ballot", headers });
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toMatchObject({
      ballotId: null,
      isLocked: false,
      votes: []
    });

    const incomplete = await app.inject({
      method: "PUT",
      url: "/ballot",
      headers,
      payload: {
        votes: [
          {
            category: "technical_achievement",
            gameId: dungeonCrawler.gameId
          }
        ]
      }
    });
    expect(incomplete.statusCode).toBe(200);
    expect(incomplete.json().isLocked).toBe(false);

    const lockTooSoon = await app.inject({
      method: "POST",
      url: "/ballot/lock",
      headers
    });
    expect(lockTooSoon.statusCode).toBe(400);

    const complete = await app.inject({
      method: "PUT",
      url: "/ballot",
      headers,
      payload: {
        votes: AWARD_CATEGORIES.map((category, index) => ({
          category,
          gameId: index === 3 ? platformer.gameId : dungeonCrawler.gameId
        }))
      }
    });
    expect(complete.statusCode).toBe(200);
    expect(complete.json().votes).toHaveLength(4);

    const locked = await app.inject({
      method: "POST",
      url: "/ballot/lock",
      headers
    });
    expect(locked.statusCode).toBe(200);
    expect(locked.json().isLocked).toBe(true);
    expect(locked.json().lockedAt).toBeTruthy();

    const lockedAgain = await app.inject({
      method: "POST",
      url: "/ballot/lock",
      headers
    });
    expect(lockedAgain.statusCode).toBe(409);
  });

  it("re-runs the schema migration without error", async () => {
    const { applyMigrations } = await import(
      "../src/database/apply-migrations.js"
    );
    await applyMigrations(pool);
    await applyMigrations(pool);
    const types = await pool.query<{ typname: string }>(
      `SELECT typname FROM pg_type WHERE typname = 'award_category'`
    );
    expect(types.rowCount).toBe(1);
  });
});
