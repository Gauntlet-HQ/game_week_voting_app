import type { PostgresVotingStore } from "../repositories/postgres-voting-store.js";
import {
  hashStaffPassword,
  staffPasswordBcryptCostForNodeEnv
} from "../security/hash-staff-password.js";

export async function bootstrapStaffPasswordHashIfMissing(input: {
  store: PostgresVotingStore;
  staffPassword: string | undefined;
  nodeEnv: string;
}): Promise<void> {
  const existingHash = await input.store.loadStaffPasswordHash();
  if (existingHash) {
    return;
  }

  if (!input.staffPassword) {
    if (input.nodeEnv === "production") {
      throw new Error(
        "STAFF_PASSWORD is required on boot when staff_credentials is empty"
      );
    }
    return;
  }

  const staffCodeHash = await hashStaffPassword(
    input.staffPassword,
    staffPasswordBcryptCostForNodeEnv(input.nodeEnv)
  );
  await input.store.insertStaffPasswordHashIfMissing(staffCodeHash);
}
