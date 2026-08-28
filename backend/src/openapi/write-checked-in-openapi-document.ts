import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyMigrations } from "../database/apply-migrations.js";
import { createPostgresPool } from "../database/create-postgres-pool.js";
import { loadRuntimeEnvironment } from "../config/load-runtime-environment.js";
import { buildVotingApp } from "../http/build-voting-app.js";

const thisDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = join(thisDirectory, "..", "..", "openapi.json");

const runtimeEnvironment = loadRuntimeEnvironment({
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? "development"
});

const pool = createPostgresPool(runtimeEnvironment.databaseUrl);
await applyMigrations(pool);
const app = await buildVotingApp({
  pool,
  sessionSecret: runtimeEnvironment.sessionSecret,
  staffPassword: runtimeEnvironment.staffPassword,
  nodeEnv: runtimeEnvironment.nodeEnv
});

try {
  const spec = app.swagger();
  await writeFile(outputPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outputPath}`);
} finally {
  await app.close();
  await pool.end();
}
