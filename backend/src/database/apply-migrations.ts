import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";

const thisDirectory = dirname(fileURLToPath(import.meta.url));

export async function applyMigrations(pool: pg.Pool): Promise<void> {
  const migrationSql = await readFile(
    join(thisDirectory, "migrations", "001_award_voting_schema.sql"),
    "utf8"
  );
  await pool.query(migrationSql);
}
