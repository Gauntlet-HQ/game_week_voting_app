import type { PostgresVotingStore } from "../repositories/postgres-voting-store.js";
import { UnknownVoterDisplayNameError } from "../errors/voting-application-errors.js";
import { staffPasswordMatchesHash } from "../security/hash-staff-password.js";
import {
  signSessionToken,
  type SignedSessionClaims
} from "../security/signed-session-token.js";

export async function createVoterSession(input: {
  store: PostgresVotingStore;
  sessionSecret: string;
  displayName: string;
  staffPassword: string | undefined;
}): Promise<SignedSessionClaims & { token: string }> {
  const voter = await input.store.findVoterByDisplayNameCaseInsensitive(
    input.displayName
  );

  if (!voter) {
    throw new UnknownVoterDisplayNameError();
  }

  const sessionGrantsStaffAccess = await determineWhetherSessionGrantsStaffAccess(
    {
      store: input.store,
      voterIsStaff: voter.isStaff,
      staffPassword: input.staffPassword
    }
  );

  const claims: SignedSessionClaims = {
    voterId: voter.voterId,
    displayName: voter.displayName,
    isStaff: sessionGrantsStaffAccess
  };

  return {
    ...claims,
    token: signSessionToken(claims, input.sessionSecret)
  };
}

async function determineWhetherSessionGrantsStaffAccess(input: {
  store: PostgresVotingStore;
  voterIsStaff: boolean;
  staffPassword: string | undefined;
}): Promise<boolean> {
  if (input.staffPassword === undefined || input.staffPassword.length === 0) {
    return false;
  }

  const staffCodeHash = await input.store.loadStaffPasswordHash();
  if (!staffCodeHash) {
    return false;
  }

  const passwordMatches = await staffPasswordMatchesHash(
    input.staffPassword,
    staffCodeHash
  );

  return passwordMatches && input.voterIsStaff;
}
