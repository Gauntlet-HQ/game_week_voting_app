import { z } from "zod";

const runtimeEnvironmentSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  STAFF_PASSWORD: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.string().optional()
});

export type RuntimeEnvironment = {
  databaseUrl: string;
  staffPassword: string | undefined;
  sessionSecret: string;
  port: number;
  host: string;
  nodeEnv: string;
};

export function loadRuntimeEnvironment(
  processEnv: NodeJS.ProcessEnv = process.env
): RuntimeEnvironment {
  const parsed = runtimeEnvironmentSchema.parse(processEnv);
  const nodeEnv = parsed.NODE_ENV ?? "development";
  const sessionSecret = parsed.SESSION_SECRET;

  if (!sessionSecret) {
    if (nodeEnv === "production") {
      throw new Error("SESSION_SECRET is required in production");
    }
  }

  return {
    databaseUrl: parsed.DATABASE_URL,
    staffPassword: parsed.STAFF_PASSWORD,
    sessionSecret:
      sessionSecret ?? "development-only-session-secret-change-me",
    port: parsed.PORT,
    host: parsed.HOST,
    nodeEnv
  };
}
