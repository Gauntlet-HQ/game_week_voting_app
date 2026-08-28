import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import type pg from "pg";
import { openApiDocument } from "../openapi/voting-api-openapi.js";
import { PostgresVotingStore } from "../repositories/postgres-voting-store.js";
import { bootstrapStaffPasswordHashIfMissing } from "../staff/bootstrap-staff-password-hash.js";
import { bootstrapStaffVoterIfRosterEmpty } from "../staff/bootstrap-staff-voter.js";
import {
  attachVotingErrorHandler,
  registerHttpRoutes
} from "./register-http-routes.js";
import "./fastify-session-augmentation.js";

export type BuildVotingAppInput = {
  pool: pg.Pool;
  sessionSecret: string;
  staffPassword: string | undefined;
  nodeEnv: string;
  bootstrapStaffDisplayName?: string;
};

export async function buildVotingApp(input: BuildVotingAppInput) {
  const app = Fastify({
    logger: input.nodeEnv !== "test"
  });

  const store = new PostgresVotingStore(input.pool);
  await bootstrapStaffPasswordHashIfMissing({
    store,
    staffPassword: input.staffPassword,
    nodeEnv: input.nodeEnv
  });
  await bootstrapStaffVoterIfRosterEmpty({
    store,
    staffPassword: input.staffPassword,
    bootstrapStaffDisplayName: input.bootstrapStaffDisplayName
  });

  await app.register(cors, { origin: true });
  await app.register(swagger, { openapi: openApiDocument });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.addContentTypeParser(
    "text/csv",
    { parseAs: "string" },
    (_request, body, done) => {
      done(null, body);
    }
  );

  attachVotingErrorHandler(app);
  await registerHttpRoutes(app, {
    store,
    sessionSecret: input.sessionSecret
  });

  await app.ready();
  return app;
}
