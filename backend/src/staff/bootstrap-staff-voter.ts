import type { PostgresVotingStore } from "../repositories/postgres-voting-store.js";

export const DEFAULT_BOOTSTRAP_STAFF_DISPLAY_NAME = "Staff";

export function resolveBootstrapStaffDisplayName(
  configuredDisplayName: string | undefined
): string {
  const trimmedDisplayName = configuredDisplayName?.trim() ?? "";
  return trimmedDisplayName.length > 0
    ? trimmedDisplayName
    : DEFAULT_BOOTSTRAP_STAFF_DISPLAY_NAME;
}

export async function bootstrapStaffVoterIfRosterEmpty(input: {
  store: PostgresVotingStore;
  staffPassword: string | undefined;
  bootstrapStaffDisplayName: string | undefined;
}): Promise<void> {
  if (!input.staffPassword) {
    return;
  }

  await input.store.insertStaffVoterWhenRosterIsEmpty(
    resolveBootstrapStaffDisplayName(input.bootstrapStaffDisplayName)
  );
}
