import { isPlainRecord } from "../isPlainRecord";

export type PublicVoterRosterEntry = {
  displayName: string;
};

export type HonorSystemSession = {
  token: string;
  voterId: string;
  displayName: string;
  isStaff: boolean;
};

export type VotingApiClient = {
  fetchPublicVoterRosterDisplayNames: () => Promise<string[]>;
  createHonorSystemSessionWithOptionalSharedStaffPassword: (input: {
    displayName: string;
    sharedStaffPassword: string;
  }) => Promise<HonorSystemSession>;
};

export function isHonorSystemSession(
  value: unknown,
): value is HonorSystemSession {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    typeof value.token === "string" &&
    value.token.length > 0 &&
    typeof value.voterId === "string" &&
    value.voterId.length > 0 &&
    typeof value.displayName === "string" &&
    value.displayName.length > 0 &&
    typeof value.isStaff === "boolean"
  );
}
