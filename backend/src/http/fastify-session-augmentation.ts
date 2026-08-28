import { FastifyRequest } from "fastify";
import type { SignedSessionClaims } from "../security/signed-session-token.js";

declare module "fastify" {
  interface FastifyRequest {
    sessionClaims?: SignedSessionClaims;
  }
}

export type { FastifyRequest };
