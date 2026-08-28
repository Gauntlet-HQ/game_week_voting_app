import {
  isHonorSystemSession,
  type HonorSystemSession,
} from "../api/votingApiTypes";
import { APP_PATHNAMES } from "../routing/appPathnames";

const honorSystemSessionStorageKey = "game-week-voting-honor-system-session";

export function writeHonorSystemSessionToBrowserStorage(
  session: HonorSystemSession,
  storage: Storage = sessionStorage,
): void {
  storage.setItem(honorSystemSessionStorageKey, JSON.stringify(session));
}

export function readHonorSystemSessionFromBrowserStorage(
  storage: Storage = sessionStorage,
): HonorSystemSession | undefined {
  const serializedSession = storage.getItem(honorSystemSessionStorageKey);
  if (!serializedSession) {
    return undefined;
  }

  try {
    const parsedSession: unknown = JSON.parse(serializedSession);
    if (!isHonorSystemSession(parsedSession)) {
      return undefined;
    }
    return parsedSession;
  } catch {
    return undefined;
  }
}

export function clearHonorSystemSessionFromBrowserStorage(
  storage: Storage = sessionStorage,
): void {
  storage.removeItem(honorSystemSessionStorageKey);
}

export function determineAppPathnameAfterHonorSystemSession(
  session: HonorSystemSession,
): string {
  if (session.isStaff) {
    return APP_PATHNAMES.staffKeep;
  }

  return APP_PATHNAMES.voterKeep;
}
