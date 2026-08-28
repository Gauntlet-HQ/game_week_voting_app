import { useCallback, useEffect, useState, type FormEvent } from "react";
import { VotingApiRequestFailedError } from "../../api/VotingApiRequestFailedError";
import type {
  HonorSystemSession,
  VotingApiClient,
} from "../../api/votingApiTypes";
import {
  GoldButton,
  HeadingDisplay,
  PageShell,
  ParchmentCard,
  StoneInput,
} from "../../design-system";
import styles from "./NameGatePage.module.css";

type NameGatePageProperties = {
  votingApiClient: VotingApiClient;
  onHonorSystemSessionEstablished: (session: HonorSystemSession) => void;
};

export function NameGatePage({
  votingApiClient,
  onHonorSystemSessionEstablished,
}: NameGatePageProperties) {
  const [rosterDisplayNames, setRosterDisplayNames] = useState<string[]>([]);
  const [rosterLoadState, setRosterLoadState] = useState<
    "loading" | "ready" | "failed"
  >("loading");
  const [rosterFailureMessage, setRosterFailureMessage] = useState<
    string | undefined
  >(undefined);
  const [selectedDisplayName, setSelectedDisplayName] = useState<
    string | undefined
  >(undefined);
  const [sharedStaffPassword, setSharedStaffPassword] = useState("");
  const [isSubmittingHonorSystemSession, setIsSubmittingHonorSystemSession] =
    useState(false);
  const [sessionFailureMessage, setSessionFailureMessage] = useState<
    string | undefined
  >(undefined);

  const summonPublicVoterRoster = useCallback(async () => {
    setRosterLoadState("loading");
    setRosterFailureMessage(undefined);
    setSelectedDisplayName(undefined);

    try {
      const displayNames =
        await votingApiClient.fetchPublicVoterRosterDisplayNames();
      setRosterDisplayNames(displayNames);
      setRosterLoadState("ready");
    } catch (error: unknown) {
      setRosterDisplayNames([]);
      setRosterLoadState("failed");
      setRosterFailureMessage(describeRosterSummonFailure(error));
    }
  }, [votingApiClient]);

  useEffect(() => {
    void summonPublicVoterRoster();
  }, [summonPublicVoterRoster]);

  async function submitHonorSystemNamePick(
    formSubmitEvent: FormEvent<HTMLFormElement>,
  ) {
    formSubmitEvent.preventDefault();

    if (!selectedDisplayName || isSubmittingHonorSystemSession) {
      return;
    }

    setIsSubmittingHonorSystemSession(true);
    setSessionFailureMessage(undefined);

    try {
      const session =
        await votingApiClient.createHonorSystemSessionWithOptionalSharedStaffPassword(
          {
            displayName: selectedDisplayName,
            sharedStaffPassword,
          },
        );
      onHonorSystemSessionEstablished(session);
    } catch (error: unknown) {
      setSessionFailureMessage(describeHonorSystemSessionFailure(error));
      setIsSubmittingHonorSystemSession(false);
    }
  }

  const enterTheHallIsDisabled =
    rosterLoadState !== "ready" ||
    !selectedDisplayName ||
    isSubmittingHonorSystemSession;

  return (
    <PageShell>
      <div className={styles.gateLayout}>
        <HeadingDisplay>Game Week Voting</HeadingDisplay>
        <ParchmentCard>
          <HeadingDisplay headingLevel={2} inkTone="parchment">
            Name the champion
          </HeadingDisplay>
          <p>
            Pick your name from the guild roster. Champions need no password —
            the honor system is the lock. If you keep the shared staff seal,
            enter it below. It is one password for every staff name, not a
            personal code.
          </p>
          <form onSubmit={submitHonorSystemNamePick}>
            <div className={styles.gateFormLayout}>
              {rosterLoadState === "loading" ? (
                <p>The heralds are fetching the roster…</p>
              ) : null}
              {rosterLoadState === "failed" ? (
                <p>{rosterFailureMessage}</p>
              ) : null}
              {rosterLoadState === "ready" &&
              rosterDisplayNames.length === 0 ? (
                <p>The roster has no names. The hall cannot open.</p>
              ) : null}
              {rosterLoadState === "ready" && rosterDisplayNames.length > 0 ? (
                <div
                  className={styles.rosterList}
                  role="listbox"
                  aria-label="Guild roster"
                >
                  {rosterDisplayNames.map((displayName) => {
                    const isSelectedDisplayName =
                      displayName === selectedDisplayName;

                    return (
                      <div
                        key={displayName}
                        role="option"
                        aria-selected={isSelectedDisplayName}
                      >
                        <GoldButton
                          variant={
                            isSelectedDisplayName ? "primary" : "secondary"
                          }
                          isDisabled={isSubmittingHonorSystemSession}
                          onClick={() => {
                            setSelectedDisplayName(displayName);
                          }}
                        >
                          {displayName}
                        </GoldButton>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <StoneInput
                labelText="Shared staff password"
                inputName="staffPassword"
                inputType="password"
                value={sharedStaffPassword}
                onValueChange={setSharedStaffPassword}
                placeholderText="Optional shared seal"
                isDisabled={isSubmittingHonorSystemSession}
              />
              {sessionFailureMessage ? <p>{sessionFailureMessage}</p> : null}
              <div className={styles.gateActions}>
                <GoldButton type="submit" isDisabled={enterTheHallIsDisabled}>
                  Enter the hall
                </GoldButton>
                {rosterLoadState === "failed" ? (
                  <GoldButton
                    variant="secondary"
                    onClick={() => {
                      void summonPublicVoterRoster();
                    }}
                  >
                    Summon the roster again
                  </GoldButton>
                ) : null}
              </div>
            </div>
          </form>
        </ParchmentCard>
      </div>
    </PageShell>
  );
}

function describeRosterSummonFailure(error: unknown): string {
  if (error instanceof VotingApiRequestFailedError) {
    return error.message;
  }

  return "The guild roster could not be summoned.";
}

function describeHonorSystemSessionFailure(error: unknown): string {
  if (error instanceof VotingApiRequestFailedError) {
    if (error.httpStatusCode === 401) {
      return "That name is not on the guild roster.";
    }

    return error.message;
  }

  return "The gatekeepers could not hear your name.";
}
