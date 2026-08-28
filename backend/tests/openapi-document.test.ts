import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { provisionTestPostgres } from "./helpers/provision-test-postgres.js";
import { buildTestVotingApp } from "./helpers/voting-test-fixtures.js";

const REQUIRED_PATHS = [
  "/voters",
  "/sessions",
  "/games",
  "/ballot",
  "/ballot/lock",
  "/staff/games/import",
  "/staff/voters/import",
  "/staff/results"
];

describe("OpenAPI document", () => {
  let pool: pg.Pool;
  let stop: () => Promise<void>;
  let app: FastifyInstance;

  beforeAll(async () => {
    const postgres = await provisionTestPostgres();
    pool = postgres.pool;
    stop = postgres.stop;
    app = await buildTestVotingApp(pool);
  });

  afterAll(async () => {
    await app.close();
    await stop();
  });

  it("exposes every product HTTP path in Fastify swagger and the checked-in spec", () => {
    const spec = app.swagger();
    const checkedIn = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), "..", "openapi.json"),
        "utf8"
      )
    ) as { paths: Record<string, unknown> };

    for (const path of REQUIRED_PATHS) {
      expect(spec.paths, `missing ${path}`).toHaveProperty(path);
      expect(checkedIn.paths, `checked-in spec missing ${path}`).toHaveProperty(
        path
      );
    }
  });
});
