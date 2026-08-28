import { useEffect, useState } from "react";
import type { HonorSystemSession, VotingApiClient } from "../api/votingApiTypes";
import { DesignSystemGallery } from "../pages/DesignSystemGallery/DesignSystemGallery";
import { DestinationKeepPage } from "../pages/keeps/DestinationKeepPage";
import { NameGatePage } from "../pages/NameGate/NameGatePage";
import {
  clearHonorSystemSessionFromBrowserStorage,
  determineAppPathnameAfterHonorSystemSession,
  readHonorSystemSessionFromBrowserStorage,
  writeHonorSystemSessionToBrowserStorage,
} from "../session/honorSystemSessionStorage";
import { APP_PATHNAMES } from "./appPathnames";
import { useBrowserPathname } from "./useBrowserPathname";

type AppRouterProperties = {
  votingApiClient: VotingApiClient;
};

export function AppRouter({ votingApiClient }: AppRouterProperties) {
  const [pathname, navigateToPathname] = useBrowserPathname();
  const [honorSystemSession, setHonorSystemSession] = useState<
    HonorSystemSession | undefined
  >(() => readHonorSystemSessionFromBrowserStorage());

  useEffect(() => {
    if (
      pathname === APP_PATHNAMES.voterKeep &&
      honorSystemSession === undefined
    ) {
      navigateToPathname(APP_PATHNAMES.nameGate);
      return;
    }

    if (pathname === APP_PATHNAMES.staffKeep) {
      if (honorSystemSession === undefined) {
        navigateToPathname(APP_PATHNAMES.nameGate);
        return;
      }

      if (!honorSystemSession.isStaff) {
        navigateToPathname(APP_PATHNAMES.voterKeep);
      }
    }
  }, [pathname, honorSystemSession, navigateToPathname]);

  function rememberHonorSystemSessionAndEnterTheAppropriateHall(
    session: HonorSystemSession,
  ) {
    writeHonorSystemSessionToBrowserStorage(session);
    setHonorSystemSession(session);
    navigateToPathname(determineAppPathnameAfterHonorSystemSession(session));
  }

  function returnToTheNameGate() {
    clearHonorSystemSessionFromBrowserStorage();
    setHonorSystemSession(undefined);
    navigateToPathname(APP_PATHNAMES.nameGate);
  }

  if (pathname === APP_PATHNAMES.gallery) {
    return <DesignSystemGallery />;
  }

  if (pathname === APP_PATHNAMES.staffKeep && honorSystemSession?.isStaff) {
    return (
      <DestinationKeepPage
        keepKind="staff"
        displayName={honorSystemSession.displayName}
        onReturnToNameGate={returnToTheNameGate}
      />
    );
  }

  if (pathname === APP_PATHNAMES.voterKeep && honorSystemSession) {
    return (
      <DestinationKeepPage
        keepKind="voter"
        displayName={honorSystemSession.displayName}
        onReturnToNameGate={returnToTheNameGate}
      />
    );
  }

  return (
    <NameGatePage
      votingApiClient={votingApiClient}
      onHonorSystemSessionEstablished={
        rememberHonorSystemSessionAndEnterTheAppropriateHall
      }
      onOpenHeraldryGallery={() => {
        navigateToPathname(APP_PATHNAMES.gallery);
      }}
    />
  );
}
