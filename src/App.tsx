import { useMemo } from "react";
import { createVotingApiClient } from "./api/createVotingApiClient";
import { invokeWindowFetch } from "./api/invokeWindowFetch";
import { readVotingApiBaseUrl } from "./api/readVotingApiBaseUrl";
import { AppRouter } from "./routing/AppRouter";

export function App() {
  const votingApiClient = useMemo(
    () =>
      createVotingApiClient({
        fetchImplementation: invokeWindowFetch,
        apiBaseUrl: readVotingApiBaseUrl(),
      }),
    [],
  );

  return <AppRouter votingApiClient={votingApiClient} />;
}
