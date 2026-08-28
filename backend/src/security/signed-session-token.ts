import { createHmac, timingSafeEqual } from "node:crypto";

export type SignedSessionClaims = {
  voterId: string;
  displayName: string;
  isStaff: boolean;
};

export function signSessionToken(
  claims: SignedSessionClaims,
  sessionSecret: string
): string {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString(
    "base64url"
  );
  const signature = createHmac("sha256", sessionSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(
  token: string,
  sessionSecret: string
): SignedSessionClaims {
  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0) {
    throw new InvalidSessionTokenError();
  }

  const payload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expectedSignature = createHmac("sha256", sessionSecret)
    .update(payload)
    .digest("base64url");

  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new InvalidSessionTokenError();
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as SignedSessionClaims;
    if (
      typeof parsed.voterId !== "string" ||
      typeof parsed.displayName !== "string" ||
      typeof parsed.isStaff !== "boolean"
    ) {
      throw new InvalidSessionTokenError();
    }
    return parsed;
  } catch (error) {
    if (error instanceof InvalidSessionTokenError) {
      throw error;
    }
    throw new InvalidSessionTokenError();
  }
}

export class InvalidSessionTokenError extends Error {
  constructor() {
    super("Session token is invalid");
    this.name = "InvalidSessionTokenError";
  }
}
