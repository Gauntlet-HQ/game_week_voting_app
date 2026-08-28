import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { loadRuntimeEnvironment } from "../src/config/load-runtime-environment.js";
import { buildVotingApp } from "../src/http/build-voting-app.js";
import { provisionTestPostgres } from "./helpers/provision-test-postgres.js";
import {
  createSession,
  insertVoter,
  resetVotingDatabase,
  TEST_SESSION_SECRET,
  TEST_STAFF_PASSWORD
} from "./helpers/voting-test-fixtures.js";

describe("loadRuntimeEnvironment bootstrap staff name", () => {
  it("defaults BOOTSTRAP_STAFF_NAME to Staff", () => {
    const runtimeEnvironment = loadRuntimeEnvironment({
      DATABASE_URL: "postgresql://voting:voting@127.0.0.1:5432/voting_test",
      NODE_ENV: "test"
    });
    expect(runtimeEnvironment.bootstrapStaffDisplayName).toBe("Staff");
  });

  it("reads BOOTSTRAP_STAFF_NAME and treats blank values as Staff", () => {
    const named = loadRuntimeEnvironment({
      DATABASE_URL: "postgresql://voting:voting@127.0.0.1:5432/voting_test",
      NODE_ENV: "test",
      BOOTSTRAP_STAFF_NAME: "Keep Warden"
    });
    const blank = loadRuntimeEnvironment({
      DATABASE_URL: "postgresql://voting:voting@127.0.0.1:5432/voting_test",
      NODE_ENV: "test",
      BOOTSTRAP_STAFF_NAME: "   "
    });
    expect(named.bootstrapStaffDisplayName).toBe("Keep Warden");
    expect(blank.bootstrapStaffDisplayName).toBe("Staff");
  });
});

describe("bootstrap staff voter when the roster is empty", () => {
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

  it("inserts one staff voter named Staff when the roster is empty and STAFF_PASSWORD is configured", async () => {
    const app = await bootVotingApp(pool, { staffPassword: TEST_STAFF_PASSWORD });

    try {
      expect(await listVoters(pool)).toEqual([
        { displayName: "Staff", isStaff: true }
      ]);
    } finally {
      await app.close();
    }
  });

  it("inserts one staff voter named from BOOTSTRAP_STAFF_NAME when the roster is empty", async () => {
    const app = await bootVotingApp(pool, {
      staffPassword: TEST_STAFF_PASSWORD,
      bootstrapStaffDisplayName: "Keep Warden"
    });

    try {
      expect(await listVoters(pool)).toEqual([
        { displayName: "Keep Warden", isStaff: true }
      ]);
    } finally {
      await app.close();
    }
  });

  it("does not insert a voter when the roster is empty and STAFF_PASSWORD is not configured", async () => {
    const app = await bootVotingApp(pool, { staffPassword: undefined });

    try {
      expect(await listVoters(pool)).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it("does not insert an extra bootstrap row when voters already exist", async () => {
    await insertVoter(pool, { displayName: "Ada Lovelace", isStaff: false });
    await insertVoter(pool, { displayName: "Grace Hopper", isStaff: true });

    const firstBoot = await bootVotingApp(pool, {
      staffPassword: TEST_STAFF_PASSWORD,
      bootstrapStaffDisplayName: "Staff"
    });
    await firstBoot.close();
    const secondBoot = await bootVotingApp(pool, {
      staffPassword: TEST_STAFF_PASSWORD,
      bootstrapStaffDisplayName: "Staff"
    });

    try {
      expect(await listVoters(pool)).toEqual([
        { displayName: "Ada Lovelace", isStaff: false },
        { displayName: "Grace Hopper", isStaff: true }
      ]);
    } finally {
      await secondBoot.close();
    }
  });

  it("includes the bootstrap display name on GET /voters", async () => {
    const app = await bootVotingApp(pool, { staffPassword: TEST_STAFF_PASSWORD });

    try {
      const response = await app.inject({ method: "GET", url: "/voters" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        voters: [{ displayName: "Staff" }]
      });
    } finally {
      await app.close();
    }
  });

  it("creates a staff session when POST /sessions uses the bootstrap name and the shared staff password", async () => {
    const app = await bootVotingApp(pool, { staffPassword: TEST_STAFF_PASSWORD });

    try {
      const session = await createSession(app, {
        displayName: "Staff",
        staffPassword: TEST_STAFF_PASSWORD
      });
      expect(session.statusCode).toBe(200);
      expect(session.body.displayName).toBe("Staff");
      expect(session.body.isStaff).toBe(true);
      expect(session.body.token).toBeTruthy();
    } finally {
      await app.close();
    }
  });
});

async function bootVotingApp(
  pool: pg.Pool,
  input: {
    staffPassword: string | undefined;
    bootstrapStaffDisplayName?: string;
  }
): Promise<FastifyInstance> {
  return buildVotingApp({
    pool,
    sessionSecret: TEST_SESSION_SECRET,
    staffPassword: input.staffPassword,
    nodeEnv: "test",
    bootstrapStaffDisplayName: input.bootstrapStaffDisplayName
  });
}

async function listVoters(
  pool: pg.Pool
): Promise<Array<{ displayName: string; isStaff: boolean }>> {
  const result = await pool.query<{ display_name: string; is_staff: boolean }>(
    `
      SELECT display_name, is_staff
      FROM voters
      ORDER BY lower(display_name)
    `
  );
  return result.rows.map((row) => ({
    displayName: row.display_name,
    isStaff: row.is_staff
  }));
}
