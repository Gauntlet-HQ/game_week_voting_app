import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { provisionTestPostgres } from "./helpers/provision-test-postgres.js";
import {
  bearer,
  buildTestVotingApp,
  createSession,
  insertVoter,
  resetVotingDatabase,
  TEST_STAFF_PASSWORD
} from "./helpers/voting-test-fixtures.js";

describe("session staff password", () => {
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

  it("does not grant staff and does not leak staff status when the shared password is wrong", async () => {
    await insertVoter(pool, { displayName: "Staff Sage", isStaff: true });
    await insertVoter(pool, { displayName: "Ada Lovelace", isStaff: false });

    const staffWrongPassword = await createSession(app, {
      displayName: "Staff Sage",
      staffPassword: "definitely-not-the-staff-password"
    });
    const regularWrongPassword = await createSession(app, {
      displayName: "Ada Lovelace",
      staffPassword: "definitely-not-the-staff-password"
    });
    const staffWithoutPassword = await createSession(app, {
      displayName: "Staff Sage"
    });

    expect(staffWrongPassword.statusCode).toBe(200);
    expect(regularWrongPassword.statusCode).toBe(200);
    expect(staffWithoutPassword.statusCode).toBe(200);

    expect(staffWrongPassword.body.isStaff).toBe(false);
    expect(regularWrongPassword.body.isStaff).toBe(false);
    expect(staffWithoutPassword.body.isStaff).toBe(false);

    expect(Object.keys(staffWrongPassword.body).sort()).toEqual(
      Object.keys(regularWrongPassword.body).sort()
    );
  });

  it("grants staff only when the roster name is staff and the shared password matches", async () => {
    await insertVoter(pool, { displayName: "Staff Sage", isStaff: true });
    await insertVoter(pool, { displayName: "Ada Lovelace", isStaff: false });

    const staffCorrect = await createSession(app, {
      displayName: "Staff Sage",
      staffPassword: TEST_STAFF_PASSWORD
    });
    const regularCorrect = await createSession(app, {
      displayName: "Ada Lovelace",
      staffPassword: TEST_STAFF_PASSWORD
    });

    expect(staffCorrect.statusCode).toBe(200);
    expect(staffCorrect.body.isStaff).toBe(true);
    expect(regularCorrect.statusCode).toBe(200);
    expect(regularCorrect.body.isStaff).toBe(false);
  });

  it("returns 403 on staff routes when the session is not staff", async () => {
    await insertVoter(pool, { displayName: "Ada Lovelace", isStaff: false });
    const session = await createSession(app, { displayName: "Ada Lovelace" });

    const results = await app.inject({
      method: "GET",
      url: "/staff/results",
      headers: bearer(session.body.token!)
    });
    const gamesImport = await app.inject({
      method: "POST",
      url: "/staff/games/import",
      headers: {
        ...bearer(session.body.token!),
        "content-type": "text/csv"
      },
      payload: "title,submitter_name,url\n"
    });

    expect(results.statusCode).toBe(403);
    expect(gamesImport.statusCode).toBe(403);
  });
});
