import { applyMigrations } from "./database/apply-migrations.js";
import { createPostgresPool } from "./database/create-postgres-pool.js";
import { loadRuntimeEnvironment } from "./config/load-runtime-environment.js";
import { buildVotingApp } from "./http/build-voting-app.js";

const runtimeEnvironment = loadRuntimeEnvironment();
const pool = createPostgresPool(runtimeEnvironment.databaseUrl);

await applyMigrations(pool);

const app = await buildVotingApp({
  pool,
  sessionSecret: runtimeEnvironment.sessionSecret,
  staffPassword: runtimeEnvironment.staffPassword,
  nodeEnv: runtimeEnvironment.nodeEnv,
  bootstrapStaffDisplayName: runtimeEnvironment.bootstrapStaffDisplayName
});

const shutdown = async () => {
  await app.close();
  await pool.end();
};

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

try {
  await app.listen({
    port: runtimeEnvironment.port,
    host: runtimeEnvironment.host
  });
} catch (error) {
  app.log.error(error);
  await shutdown();
  process.exit(1);
}
