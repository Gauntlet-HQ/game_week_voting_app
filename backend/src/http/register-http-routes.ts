import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AWARD_CATEGORIES } from "../award-categories.js";
import {
  lockBallotForVoter,
  readBallotForVoter,
  replaceDraftBallotVotes,
  type BallotSnapshot
} from "../ballots/ballot-voting-service.js";
import {
  AuthenticationRequiredError,
  BallotAlreadyLockedError,
  BallotLockRequiresFourNonWithdrawnGamesError,
  CsvImportValidationError,
  DuplicateCategoryOnBallotError,
  StaffAuthorizationRequiredError,
  UnknownVoterDisplayNameError,
  WithdrawnOrUnknownGameNotVotableError
} from "../errors/voting-application-errors.js";
import type { PostgresVotingStore } from "../repositories/postgres-voting-store.js";
import { createVoterSession } from "../sessions/create-voter-session.js";
import {
  InvalidSessionTokenError,
  type SignedSessionClaims,
  verifySessionToken
} from "../security/signed-session-token.js";
import { importGamesFromCsv } from "../staff/import-games-from-csv.js";
import { importVoterRosterFromCsv } from "../staff/import-voter-roster-from-csv.js";
import { loadLockedBallotResults } from "../staff/load-locked-ballot-results.js";
import { isAwardCategory } from "../award-categories.js";

export type HttpRouteDependencies = {
  store: PostgresVotingStore;
  sessionSecret: string;
};

const awardCategorySchema = {
  type: "string",
  enum: [...AWARD_CATEGORIES]
} as const;

const errorMessageSchema = {
  type: "object",
  required: ["message"],
  properties: {
    message: { type: "string" }
  }
} as const;

const ballotVoteSchema = {
  type: "object",
  required: ["category", "gameId"],
  properties: {
    category: awardCategorySchema,
    gameId: { type: "string", format: "uuid" }
  }
} as const;

const ballotResponseSchema = {
  type: "object",
  required: ["ballotId", "isLocked", "lockedAt", "votes"],
  properties: {
    ballotId: { type: ["string", "null"], format: "uuid" },
    isLocked: { type: "boolean" },
    lockedAt: { type: ["string", "null"], format: "date-time" },
    votes: {
      type: "array",
      items: ballotVoteSchema
    }
  }
} as const;

export async function registerHttpRoutes(
  app: FastifyInstance,
  dependencies: HttpRouteDependencies
): Promise<void> {
  const authenticate = buildAuthenticatePreHandler(dependencies.sessionSecret);
  const requireStaff = buildRequireStaffPreHandler();

  app.get(
    "/health",
    {
      schema: {
        tags: ["meta"],
        response: {
          200: {
            type: "object",
            properties: { status: { type: "string" } }
          }
        }
      }
    },
    async () => ({ status: "ok" })
  );

  app.get(
    "/voters",
    {
      schema: {
        tags: ["voters"],
        summary: "List roster display names for the honor-system name picker",
        response: {
          200: {
            type: "object",
            required: ["voters"],
            properties: {
              voters: {
                type: "array",
                items: {
                  type: "object",
                  required: ["displayName"],
                  properties: {
                    displayName: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    async () => {
      const displayNames = await dependencies.store.listVoterDisplayNames();
      return {
        voters: displayNames.map((displayName) => ({ displayName }))
      };
    }
  );

  app.post(
    "/sessions",
    {
      schema: {
        tags: ["sessions"],
        summary: "Start a session by picking a roster name (optional shared staff password)",
        body: {
          type: "object",
          required: ["displayName"],
          additionalProperties: false,
          properties: {
            displayName: { type: "string", minLength: 1 },
            staffPassword: { type: "string" }
          }
        },
        response: {
          200: {
            type: "object",
            required: ["token", "voterId", "displayName", "isStaff"],
            properties: {
              token: { type: "string" },
              voterId: { type: "string", format: "uuid" },
              displayName: { type: "string" },
              isStaff: { type: "boolean" }
            }
          },
          401: errorMessageSchema
        }
      }
    },
    async (request) => {
      const body = request.body as {
        displayName: string;
        staffPassword?: string;
      };
      return createVoterSession({
        store: dependencies.store,
        sessionSecret: dependencies.sessionSecret,
        displayName: body.displayName,
        staffPassword: body.staffPassword
      });
    }
  );

  app.get(
    "/games",
    {
      preHandler: authenticate,
      schema: {
        tags: ["games"],
        summary: "List games that have not been withdrawn from the ballot",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            required: ["games"],
            properties: {
              games: {
                type: "array",
                items: {
                  type: "object",
                  required: ["gameId", "title", "submitterName", "url"],
                  properties: {
                    gameId: { type: "string", format: "uuid" },
                    title: { type: "string" },
                    submitterName: { type: "string" },
                    url: { type: "string" }
                  }
                }
              }
            }
          },
          401: errorMessageSchema
        }
      }
    },
    async () => {
      const games = await dependencies.store.listActiveGames();
      return {
        games: games.map((game) => ({
          gameId: game.gameId,
          title: game.title,
          submitterName: game.submitterName,
          url: game.url
        }))
      };
    }
  );

  app.get(
    "/ballot",
    {
      preHandler: authenticate,
      schema: {
        tags: ["ballot"],
        summary: "Read the current voter's ballot draft or locked ballot",
        security: [{ bearerAuth: [] }],
        response: {
          200: ballotResponseSchema,
          401: errorMessageSchema
        }
      }
    },
    async (request) => {
      const session = requireSession(request);
      const snapshot = await readBallotForVoter({
        store: dependencies.store,
        voterId: session.voterId
      });
      return serializeBallot(snapshot);
    }
  );

  app.put(
    "/ballot",
    {
      preHandler: authenticate,
      schema: {
        tags: ["ballot"],
        summary: "Replace the current voter's unlocked ballot draft",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["votes"],
          additionalProperties: false,
          properties: {
            votes: {
              type: "array",
              items: ballotVoteSchema
            }
          }
        },
        response: {
          200: ballotResponseSchema,
          400: errorMessageSchema,
          401: errorMessageSchema,
          409: errorMessageSchema
        }
      }
    },
    async (request) => {
      const session = requireSession(request);
      const body = request.body as {
        votes: Array<{ category: string; gameId: string }>;
      };
      const votes = body.votes.map((vote) => {
        if (!isAwardCategory(vote.category)) {
          throw new DuplicateCategoryOnBallotError();
        }
        return { category: vote.category, gameId: vote.gameId };
      });
      const snapshot = await replaceDraftBallotVotes({
        store: dependencies.store,
        voterId: session.voterId,
        votes
      });
      return serializeBallot(snapshot);
    }
  );

  app.post(
    "/ballot/lock",
    {
      preHandler: authenticate,
      schema: {
        tags: ["ballot"],
        summary: "Lock the current voter's ballot after all four categories are filled",
        security: [{ bearerAuth: [] }],
        response: {
          200: ballotResponseSchema,
          400: errorMessageSchema,
          401: errorMessageSchema,
          409: errorMessageSchema
        }
      }
    },
    async (request) => {
      const session = requireSession(request);
      const snapshot = await lockBallotForVoter({
        store: dependencies.store,
        voterId: session.voterId
      });
      return serializeBallot(snapshot);
    }
  );

  app.post(
    "/staff/games/import",
    {
      preHandler: [authenticate, requireStaff],
      schema: {
        tags: ["staff"],
        summary: "Upsert games from CSV (title, submitter_name, url)",
        security: [{ bearerAuth: [] }],
        consumes: ["text/csv", "application/json"],
        response: {
          200: {
            type: "object",
            required: ["upserted", "deleted", "withdrawn"],
            properties: {
              upserted: { type: "integer" },
              deleted: { type: "integer" },
              withdrawn: { type: "integer" }
            }
          },
          400: errorMessageSchema,
          401: errorMessageSchema,
          403: errorMessageSchema
        }
      }
    },
    async (request) => {
      return importGamesFromCsv({
        store: dependencies.store,
        csvText: extractCsvText(request)
      });
    }
  );

  app.post(
    "/staff/voters/import",
    {
      preHandler: [authenticate, requireStaff],
      schema: {
        tags: ["staff"],
        summary: "Upsert the voter roster from CSV (display_name, is_staff)",
        security: [{ bearerAuth: [] }],
        consumes: ["text/csv", "application/json"],
        response: {
          200: {
            type: "object",
            required: ["upserted", "deleted", "keptBecauseBallotExists"],
            properties: {
              upserted: { type: "integer" },
              deleted: { type: "integer" },
              keptBecauseBallotExists: { type: "integer" }
            }
          },
          400: errorMessageSchema,
          401: errorMessageSchema,
          403: errorMessageSchema
        }
      }
    },
    async (request) => {
      return importVoterRosterFromCsv({
        store: dependencies.store,
        csvText: extractCsvText(request)
      });
    }
  );

  app.get(
    "/staff/results",
    {
      preHandler: [authenticate, requireStaff],
      schema: {
        tags: ["staff"],
        summary: "Tally locked ballots only; equal vote counts share a rank",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            required: ["lockedBallotCount", "categories"],
            properties: {
              lockedBallotCount: { type: "integer" },
              categories: {
                type: "array",
                items: {
                  type: "object",
                  required: ["category", "standings"],
                  properties: {
                    category: awardCategorySchema,
                    standings: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["rank", "voteCount", "isTied", "game"],
                        properties: {
                          rank: { type: "integer" },
                          voteCount: { type: "integer" },
                          isTied: { type: "boolean" },
                          game: {
                            type: "object",
                            required: [
                              "gameId",
                              "title",
                              "submitterName",
                              "url"
                            ],
                            properties: {
                              gameId: { type: "string", format: "uuid" },
                              title: { type: "string" },
                              submitterName: { type: "string" },
                              url: { type: "string" }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          401: errorMessageSchema,
          403: errorMessageSchema
        }
      }
    },
    async () => loadLockedBallotResults(dependencies.store)
  );
}

export function attachVotingErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: unknown, _request, reply) => {
    if (error instanceof UnknownVoterDisplayNameError) {
      return sendError(reply, 401, error.message);
    }
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof InvalidSessionTokenError
    ) {
      return sendError(reply, 401, error.message);
    }
    if (error instanceof StaffAuthorizationRequiredError) {
      return sendError(reply, 403, error.message);
    }
    if (error instanceof BallotAlreadyLockedError) {
      return sendError(reply, 409, error.message);
    }
    if (
      error instanceof BallotLockRequiresFourNonWithdrawnGamesError ||
      error instanceof WithdrawnOrUnknownGameNotVotableError ||
      error instanceof DuplicateCategoryOnBallotError ||
      error instanceof CsvImportValidationError
    ) {
      return sendError(reply, 400, error.message);
    }

    const postgresCode =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : undefined;
    const message =
      error instanceof Error ? error.message : "Request could not be processed";

    if (postgresCode === "23505") {
      return sendError(
        reply,
        409,
        "A unique constraint prevented this write (one vote per voter and category)"
      );
    }
    if (postgresCode === "23514") {
      return sendError(reply, 400, message);
    }
    if (postgresCode === "23503") {
      return sendError(
        reply,
        409,
        "A RESTRICT foreign key prevented this delete or write"
      );
    }

    const statusCode =
      typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : undefined;
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return sendError(reply, statusCode, message);
    }

    app.log.error(error);
    return sendError(reply, 500, "Internal server error");
  });
}

function buildAuthenticatePreHandler(sessionSecret: string) {
  return async (request: FastifyRequest): Promise<void> => {
    const header = request.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new AuthenticationRequiredError();
    }
    const token = header.slice("Bearer ".length).trim();
    if (token.length === 0) {
      throw new AuthenticationRequiredError();
    }
    request.sessionClaims = verifySessionToken(token, sessionSecret);
  };
}

function buildRequireStaffPreHandler() {
  return async (request: FastifyRequest): Promise<void> => {
    const session = requireSession(request);
    if (!session.isStaff) {
      throw new StaffAuthorizationRequiredError();
    }
  };
}

function requireSession(request: FastifyRequest): SignedSessionClaims {
  if (!request.sessionClaims) {
    throw new AuthenticationRequiredError();
  }
  return request.sessionClaims;
}

function serializeBallot(snapshot: BallotSnapshot) {
  return {
    ballotId: snapshot.ballotId,
    isLocked: snapshot.isLocked,
    lockedAt: snapshot.lockedAt ? snapshot.lockedAt.toISOString() : null,
    votes: snapshot.votes.map((vote) => ({
      category: vote.category,
      gameId: vote.gameId
    }))
  };
}

function extractCsvText(request: FastifyRequest): string {
  const body = request.body;
  if (typeof body === "string") {
    return body;
  }
  if (body && typeof body === "object" && "csv" in body) {
    const csv = (body as { csv?: unknown }).csv;
    if (typeof csv === "string") {
      return csv;
    }
  }
  throw new CsvImportValidationError(
    "CSV import requires a text/csv body or JSON { csv: string }"
  );
}

function sendError(reply: FastifyReply, statusCode: number, message: string) {
  return reply.status(statusCode).send({ message });
}
