export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Game Week Voting API",
    version: "0.1.0",
    description:
      "Honor-system voter roster, one vote per award category, shared staff password for CSV upload and results."
  },
  tags: [
    { name: "meta", description: "Health and documentation" },
    { name: "voters", description: "Public roster name picker" },
    { name: "sessions", description: "Honor-system sessions" },
    { name: "games", description: "Active ballot games" },
    { name: "ballot", description: "Draft and lock a voter's ballot" },
    { name: "staff", description: "Shared-password staff import and results" }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http" as const,
        scheme: "bearer",
        bearerFormat: "opaque-signed-token",
        description:
          "Session token from POST /sessions. Encodes voter_id and isStaff."
      }
    }
  }
};
