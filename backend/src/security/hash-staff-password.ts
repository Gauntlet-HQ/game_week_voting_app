import bcrypt from "bcryptjs";

const PRODUCTION_BCRYPT_COST = 12;
const TEST_BCRYPT_COST = 4;

export function staffPasswordBcryptCostForNodeEnv(nodeEnv: string): number {
  return nodeEnv === "test" ? TEST_BCRYPT_COST : PRODUCTION_BCRYPT_COST;
}

export async function hashStaffPassword(
  plaintextStaffPassword: string,
  bcryptCost: number
): Promise<string> {
  return bcrypt.hash(plaintextStaffPassword, bcryptCost);
}

export async function staffPasswordMatchesHash(
  plaintextStaffPassword: string,
  staffCodeHash: string
): Promise<boolean> {
  return bcrypt.compare(plaintextStaffPassword, staffCodeHash);
}
