import { describe, expect, it } from "vitest";
import { APP_PATHNAMES } from "../routing/appPathnames";
import {
  clearHonorSystemSessionFromBrowserStorage,
  determineAppPathnameAfterHonorSystemSession,
  readHonorSystemSessionFromBrowserStorage,
  writeHonorSystemSessionToBrowserStorage,
} from "./honorSystemSessionStorage";

const voterSession = {
  token: "voter-token",
  voterId: "11111111-1111-1111-1111-111111111111",
  displayName: "Ada Lovelace",
  isStaff: false,
} as const;

const staffSession = {
  token: "staff-token",
  voterId: "22222222-2222-2222-2222-222222222222",
  displayName: "Staff Sage",
  isStaff: true,
} as const;

describe("honorSystemSessionStorage", () => {
  it("round-trips an honor-system session through browser storage", () => {
    writeHonorSystemSessionToBrowserStorage(voterSession);

    expect(readHonorSystemSessionFromBrowserStorage()).toEqual(voterSession);
  });

  it("forgets a stored session when the champion returns to the gate", () => {
    writeHonorSystemSessionToBrowserStorage(staffSession);
    clearHonorSystemSessionFromBrowserStorage();

    expect(readHonorSystemSessionFromBrowserStorage()).toBeUndefined();
  });

  it("routes staff sessions to the staff keep and everyone else to the champion keep", () => {
    expect(determineAppPathnameAfterHonorSystemSession(staffSession)).toBe(
      APP_PATHNAMES.staffKeep,
    );
    expect(determineAppPathnameAfterHonorSystemSession(voterSession)).toBe(
      APP_PATHNAMES.voterKeep,
    );
  });
});
