import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { provisionTestPostgres } from "./helpers/provision-test-postgres.js";
import {
  bearer,
  buildTestVotingApp,
  createSession,
  insertGame,
  insertUnlockedBallot,
  insertVote,
  insertVoter,
  resetVotingDatabase,
  TEST_STAFF_PASSWORD
} from "./helpers/voting-test-fixtures.js";

describe("CSV import rules", () => {
  let pool: pg.Pool;
  let stop: () => Promise<void>;
  let app: FastifyInstance;
  let staffToken: string;

  beforeAll(async () => {
    const postgres = await provisionTestPostgres();
    pool = postgres.pool;
    stop = postgres.stop;
    app = await buildTestVotingApp(pool);
  });

  beforeEach(async () => {
    await resetVotingDatabase(pool);
    await insertVoter(pool, { displayName: "Staff Sage", isStaff: true });
    const session = await createSession(app, {
      displayName: "Staff Sage",
      staffPassword: TEST_STAFF_PASSWORD
    });
    staffToken = session.body.token!;
  });

  afterAll(async () => {
    await app.close();
    await stop();
  });

  it("upserts games by url and deletes a missing game that has zero votes", async () => {
    await insertGame(pool, {
      title: "Old Title",
      submitterName: "Old Submitter",
      url: "https://example.com/keep"
    });
    await insertGame(pool, {
      title: "Orphan Game",
      submitterName: "Nobody",
      url: "https://example.com/orphan"
    });

    const response = await app.inject({
      method: "POST",
      url: "/staff/games/import",
      headers: {
        ...bearer(staffToken),
        "content-type": "text/csv"
      },
      payload: [
        "title,submitter_name,url",
        "New Title,New Submitter,https://example.com/keep",
        "Fresh Game,Ada,https://example.com/fresh"
      ].join("\n")
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      upserted: 2,
      deleted: 1,
      withdrawn: 0
    });

    const games = await pool.query<{
      title: string;
      submitter_name: string;
      url: string;
      withdrawn_from_ballot: boolean;
    }>(
      `SELECT title, submitter_name, url, withdrawn_from_ballot FROM games ORDER BY url`
    );
    expect(games.rows).toEqual([
      {
        title: "Fresh Game",
        submitter_name: "Ada",
        url: "https://example.com/fresh",
        withdrawn_from_ballot: false
      },
      {
        title: "New Title",
        submitter_name: "New Submitter",
        url: "https://example.com/keep",
        withdrawn_from_ballot: false
      }
    ]);
  });

  it("marks a missing game as withdrawn when it already has votes instead of deleting it", async () => {
    const voter = await insertVoter(pool, { displayName: "Ada Lovelace" });
    const kept = await insertGame(pool, {
      title: "Kept Game",
      submitterName: "Ada",
      url: "https://example.com/kept"
    });
    const voted = await insertGame(pool, {
      title: "Voted Game",
      submitterName: "Grace",
      url: "https://example.com/voted"
    });
    const ballotId = await insertUnlockedBallot(pool, voter.voterId);
    await insertVote(pool, {
      ballotId,
      voterId: voter.voterId,
      category: "best_overall",
      gameId: voted.gameId
    });

    const response = await app.inject({
      method: "POST",
      url: "/staff/games/import",
      headers: {
        ...bearer(staffToken),
        "content-type": "text/csv"
      },
      payload: [
        "title,submitter_name,url",
        `Kept Game,Ada,${kept.url}`
      ].join("\n")
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      deleted: 0,
      withdrawn: 1
    });

    const votedRow = await pool.query<{ withdrawn_from_ballot: boolean }>(
      `SELECT withdrawn_from_ballot FROM games WHERE game_id = $1`,
      [voted.gameId]
    );
    expect(votedRow.rows[0]?.withdrawn_from_ballot).toBe(true);
  });

  it("upserts voters by lower(display_name) and deletes a missing voter who has no ballot", async () => {
    await insertVoter(pool, { displayName: "ada lovelace" });
    await insertVoter(pool, { displayName: "Orphan Voter" });

    const response = await app.inject({
      method: "POST",
      url: "/staff/voters/import",
      headers: {
        ...bearer(staffToken),
        "content-type": "text/csv"
      },
      payload: [
        "display_name,is_staff",
        "Staff Sage,true",
        "Ada Lovelace,false",
        "Grace Hopper,true"
      ].join("\n")
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      upserted: 3,
      deleted: 1,
      keptBecauseBallotExists: 0
    });

    const voters = await pool.query<{ display_name: string; is_staff: boolean }>(
      `SELECT display_name, is_staff FROM voters ORDER BY lower(display_name)`
    );
    expect(voters.rows).toEqual([
      { display_name: "Ada Lovelace", is_staff: false },
      { display_name: "Grace Hopper", is_staff: true },
      { display_name: "Staff Sage", is_staff: true }
    ]);
  });

  it("keeps a missing voter who already has a ballot", async () => {
    const voterWithBallot = await insertVoter(pool, {
      displayName: "Ballot Holder"
    });
    await insertUnlockedBallot(pool, voterWithBallot.voterId);

    const response = await app.inject({
      method: "POST",
      url: "/staff/voters/import",
      headers: {
        ...bearer(staffToken),
        "content-type": "text/csv"
      },
      payload: [
        "display_name,is_staff",
        "Staff Sage,true",
        "Ada Lovelace,false"
      ].join("\n")
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      deleted: 0,
      keptBecauseBallotExists: 1
    });

    const remaining = await pool.query<{ display_name: string }>(
      `SELECT display_name FROM voters WHERE display_name = 'Ballot Holder'`
    );
    expect(remaining.rowCount).toBe(1);
  });

  it("restores a previously withdrawn game when it reappears on the sheet", async () => {
    await insertGame(pool, {
      title: "Back Again",
      submitterName: "Ada",
      url: "https://example.com/back",
      withdrawnFromBallot: true
    });

    const response = await app.inject({
      method: "POST",
      url: "/staff/games/import",
      headers: {
        ...bearer(staffToken),
        "content-type": "text/csv"
      },
      payload: [
        "title,submitter_name,url",
        "Back Again,Ada,https://example.com/back"
      ].join("\n")
    });

    expect(response.statusCode).toBe(200);
    const row = await pool.query<{ withdrawn_from_ballot: boolean }>(
      `SELECT withdrawn_from_ballot FROM games WHERE url = 'https://example.com/back'`
    );
    expect(row.rows[0]?.withdrawn_from_ballot).toBe(false);
  });
});
