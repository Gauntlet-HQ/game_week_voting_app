import { PostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import { applyMigrations } from "../../src/database/apply-migrations.js";

const LOCAL_POSTGRES_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://voting:voting@127.0.0.1:5432/voting_test";

export type TestPostgres = {
  pool: pg.Pool;
  connectionString: string;
  stop: () => Promise<void>;
};

export async function provisionTestPostgres(): Promise<TestPostgres> {
  const local = await tryLocalPostgres(LOCAL_POSTGRES_URL);
  if (local) {
    await applyMigrations(local.pool);
    return local;
  }

  if (process.env.TEST_USE_TESTCONTAINERS === "0") {
    throw new Error(
      `Could not connect to local Postgres at ${LOCAL_POSTGRES_URL}. Set TEST_DATABASE_URL or allow testcontainers.`
    );
  }

  try {
    const container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const connectionString = container.getConnectionString();
    const pool = new pg.Pool({ connectionString });
    await applyMigrations(pool);
    return {
      pool,
      connectionString,
      stop: async () => {
        await pool.end();
        await container.stop();
      }
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not connect to local Postgres at ${LOCAL_POSTGRES_URL} and testcontainers failed (${reason}). Tests must use local Postgres or testcontainers, not Railway.`
    );
  }
}

async function tryLocalPostgres(
  connectionString: string
): Promise<TestPostgres | undefined> {
  const pool = new pg.Pool({ connectionString });
  try {
    await pool.query("SELECT 1");
    return {
      pool,
      connectionString,
      stop: async () => {
        await pool.end();
      }
    };
  } catch {
    await pool.end().catch(() => undefined);
    return undefined;
  }
}
