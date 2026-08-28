import { applyMigrations } from "./apply-migrations.js";
import { createPostgresPool } from "./create-postgres-pool.js";
import { loadRuntimeEnvironment } from "../config/load-runtime-environment.js";

const runtimeEnvironment = loadRuntimeEnvironment();
const pool = createPostgresPool(runtimeEnvironment.databaseUrl);

try {
  await applyMigrations(pool);
  console.log("Applied award voting schema migration.");
} finally {
  await pool.end();
}
