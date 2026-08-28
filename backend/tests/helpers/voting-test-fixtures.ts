import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { buildVotingApp } from "../../src/http/build-voting-app.js";
import { PostgresVotingStore } from "../../src/repositories/postgres-voting-store.js";
import { bootstrapStaffPasswordHashIfMissing } from "../../src/staff/bootstrap-staff-password-hash.js";
import { AWARD_CATEGORIES, type AwardCategory } from "../../src/award-categories.js";

export const TEST_SESSION_SECRET = "test-session-secret-at-least-16-chars";
export const TEST_STAFF_PASSWORD = "shared-staff-password";

export async function resetVotingDatabase(pool: pg.Pool): Promise<void> {
  await pool.query(
    `
      TRUNCATE TABLE votes, ballots, games, voters, staff_credentials
      RESTART IDENTITY
    `
  );
  const store = new PostgresVotingStore(pool);
  await bootstrapStaffPasswordHashIfMissing({
    store,
    staffPassword: TEST_STAFF_PASSWORD,
    nodeEnv: "test"
  });
}

export async function buildTestVotingApp(pool: pg.Pool): Promise<FastifyInstance> {
  return buildVotingApp({
    pool,
    sessionSecret: TEST_SESSION_SECRET,
    staffPassword: TEST_STAFF_PASSWORD,
    nodeEnv: "test"
  });
}

export async function insertVoter(
  pool: pg.Pool,
  input: { displayName: string; isStaff?: boolean }
): Promise<{ voterId: string; displayName: string; isStaff: boolean }> {
  const result = await pool.query<{
    voter_id: string;
    display_name: string;
    is_staff: boolean;
  }>(
    `
      INSERT INTO voters (display_name, is_staff)
      VALUES ($1, $2)
      RETURNING voter_id, display_name, is_staff
    `,
    [input.displayName, input.isStaff ?? false]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to insert voter");
  }
  return {
    voterId: row.voter_id,
    displayName: row.display_name,
    isStaff: row.is_staff
  };
}

export async function insertGame(
  pool: pg.Pool,
  input: {
    title: string;
    submitterName: string;
    url: string;
    withdrawnFromBallot?: boolean;
  }
): Promise<{ gameId: string; title: string; url: string }> {
  const result = await pool.query<{ game_id: string; title: string; url: string }>(
    `
      INSERT INTO games (title, submitter_name, url, withdrawn_from_ballot)
      VALUES ($1, $2, $3, $4)
      RETURNING game_id, title, url
    `,
    [
      input.title,
      input.submitterName,
      input.url,
      input.withdrawnFromBallot ?? false
    ]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to insert game");
  }
  return { gameId: row.game_id, title: row.title, url: row.url };
}

export async function insertUnlockedBallot(
  pool: pg.Pool,
  voterId: string
): Promise<string> {
  const result = await pool.query<{ ballot_id: string }>(
    `
      INSERT INTO ballots (voter_id, is_locked, locked_at)
      VALUES ($1, FALSE, NULL)
      RETURNING ballot_id
    `,
    [voterId]
  );
  const ballotId = result.rows[0]?.ballot_id;
  if (!ballotId) {
    throw new Error("Failed to insert ballot");
  }
  return ballotId;
}

export async function insertVote(
  pool: pg.Pool,
  input: {
    ballotId: string;
    voterId: string;
    category: AwardCategory;
    gameId: string;
  }
): Promise<string> {
  const result = await pool.query<{ vote_id: string }>(
    `
      INSERT INTO votes (ballot_id, voter_id, category, game_id)
      VALUES ($1, $2, $3::award_category, $4)
      RETURNING vote_id
    `,
    [input.ballotId, input.voterId, input.category, input.gameId]
  );
  const voteId = result.rows[0]?.vote_id;
  if (!voteId) {
    throw new Error("Failed to insert vote");
  }
  return voteId;
}

export async function insertCompleteDraftBallot(
  pool: pg.Pool,
  input: { voterId: string; gameIds: [string, string, string, string] }
): Promise<string> {
  const ballotId = await insertUnlockedBallot(pool, input.voterId);
  for (const [index, category] of AWARD_CATEGORIES.entries()) {
    const gameId = input.gameIds[index];
    if (!gameId) {
      throw new Error("Expected four game ids");
    }
    await insertVote(pool, {
      ballotId,
      voterId: input.voterId,
      category,
      gameId
    });
  }
  return ballotId;
}

export async function createSession(
  app: FastifyInstance,
  input: { displayName: string; staffPassword?: string }
): Promise<{
  statusCode: number;
  body: {
    token?: string;
    voterId?: string;
    displayName?: string;
    isStaff?: boolean;
    message?: string;
  };
}> {
  const response = await app.inject({
    method: "POST",
    url: "/sessions",
    payload: {
      displayName: input.displayName,
      ...(input.staffPassword !== undefined
        ? { staffPassword: input.staffPassword }
        : {})
    }
  });
  return {
    statusCode: response.statusCode,
    body: response.json()
  };
}

export function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}
