import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";

const thisDirectory = dirname(fileURLToPath(import.meta.url));

export const LOCKED_SCHEMA_MIGRATION_PATH = join(
  thisDirectory,
  "..",
  "..",
  "migrations",
  "001_award_voting_schema.sql"
);

export async function applyMigrations(pool: pg.Pool): Promise<void> {
  const migrationSql = await readFile(LOCKED_SCHEMA_MIGRATION_PATH, "utf8");
  await pool.query(migrationSql);
}
