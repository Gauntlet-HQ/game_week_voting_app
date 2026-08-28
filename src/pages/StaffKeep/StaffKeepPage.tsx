import { useCallback, useEffect, useState } from "react";
import { VotingApiRequestFailedError } from "../../api/VotingApiRequestFailedError";
import type {
  HonorSystemSession,
  StaffLockedBallotResults,
  StaffResultsStanding,
  VotingApiClient,
} from "../../api/votingApiTypes";
import { AWARD_CATEGORY_DISPLAY_NAMES } from "../../awards/awardCategories";
import {
  GamePortraitCard,
  GoldButton,
  HeadingDisplay,
  PageShell,
  ParchmentCard,
} from "../../design-system";
import {
  describeGamesCsvImportSummary,
  describeVoterRosterCsvImportSummary,
} from "../../staff/describeStaffCsvImportFeedback";
import {
  describeLockedBallotCount,
  describeStaffResultsStandingCaption,
  noSealedVotesInThisHallMessage,
} from "../../staff/describeStaffResultsCopy";
import { StaffCsvLedgerUpload } from "./StaffCsvLedgerUpload";
import styles from "./StaffKeepPage.module.css";

type StaffKeepPageProperties = {
  votingApiClient: VotingApiClient;
  honorSystemSession: HonorSystemSession;
  onReturnToNameGate: () => void;
  onOpenHeraldryGallery: () => void;
};

export function StaffKeepPage({
  votingApiClient,
  honorSystemSession,
  onReturnToNameGate,
  onOpenHeraldryGallery,
}: StaffKeepPageProperties) {
  const [isInscribingGamesLedger, setIsInscribingGamesLedger] = useState(false);
  const [gamesLedgerFeedbackMessage, setGamesLedgerFeedbackMessage] = useState<
    string | undefined
  >(undefined);
  const [isInscribingRosterLedger, setIsInscribingRosterLedger] =
    useState(false);
  const [rosterLedgerFeedbackMessage, setRosterLedgerFeedbackMessage] =
    useState<string | undefined>(undefined);
  const [resultsLoadState, setResultsLoadState] = useState<
    "loading" | "ready" | "failed"
  >("loading");
  const [resultsFailureMessage, setResultsFailureMessage] = useState<
    string | undefined
  >(undefined);
  const [lockedBallotResults, setLockedBallotResults] = useState<
    StaffLockedBallotResults | undefined
  >(undefined);

  const summonLockedBallotResults = useCallback(async () => {
    setResultsLoadState("loading");
    setResultsFailureMessage(undefined);

    try {
      const results = await votingApiClient.fetchLockedBallotResultsForStaff({
        sessionToken: honorSystemSession.token,
      });
      setLockedBallotResults(results);
      setResultsLoadState("ready");
    } catch (error: unknown) {
      setLockedBallotResults(undefined);
      setResultsLoadState("failed");
      setResultsFailureMessage(describeStaffKeepFailure(error));
    }
  }, [honorSystemSession.token, votingApiClient]);

  useEffect(() => {
    void summonLockedBallotResults();
  }, [summonLockedBallotResults]);

  async function inscribeGamesLedgerFromCsvText(csvText: string) {
    if (isInscribingGamesLedger) {
      return;
    }

    setIsInscribingGamesLedger(true);
    setGamesLedgerFeedbackMessage(undefined);

    try {
      const summary = await votingApiClient.importGamesFromCsvText({
        sessionToken: honorSystemSession.token,
        csvText,
      });
      setGamesLedgerFeedbackMessage(describeGamesCsvImportSummary(summary));
    } catch (error: unknown) {
      setGamesLedgerFeedbackMessage(describeStaffKeepFailure(error));
    } finally {
      setIsInscribingGamesLedger(false);
    }
  }

  async function inscribeRosterLedgerFromCsvText(csvText: string) {
    if (isInscribingRosterLedger) {
      return;
    }

    setIsInscribingRosterLedger(true);
    setRosterLedgerFeedbackMessage(undefined);

    try {
      const summary = await votingApiClient.importVoterRosterFromCsvText({
        sessionToken: honorSystemSession.token,
        csvText,
      });
      setRosterLedgerFeedbackMessage(
        describeVoterRosterCsvImportSummary(summary),
      );
    } catch (error: unknown) {
      setRosterLedgerFeedbackMessage(describeStaffKeepFailure(error));
    } finally {
      setIsInscribingRosterLedger(false);
    }
  }

  return (
    <PageShell>
      <div className={styles.staffKeepLayout}>
        <HeadingDisplay>Staff keep</HeadingDisplay>
        <ParchmentCard>
          <HeadingDisplay headingLevel={2} inkTone="parchment">
            The staff ledgers
          </HeadingDisplay>
          <p>
            Welcome, {honorSystemSession.displayName}. Inscribe the games and
            roster scrolls, then read the sealed results. These ledgers answer
            only to a staff session.
          </p>
          <div className={styles.staffKeepActions}>
            <GoldButton variant="secondary" onClick={onReturnToNameGate}>
              Return to the name gate
            </GoldButton>
            <GoldButton variant="secondary" onClick={onOpenHeraldryGallery}>
              Heraldry gallery
            </GoldButton>
          </div>
        </ParchmentCard>
        <StaffCsvLedgerUpload
          ledgerHeading="Games ledger"
          ledgerDescription="Upload a CSV with title, submitter_name, and url. Rows upsert by url. Titles missing from the sheet are deleted, or withdrawn if they already have votes."
          csvFileInputName="gamesCsv"
          csvFileInputLabelText="Games CSV"
          chooseCsvButtonLabel="Choose games CSV"
          inscribeLedgerButtonLabel="Inscribe the games ledger"
          isInscribingLedger={isInscribingGamesLedger}
          ledgerFeedbackMessage={gamesLedgerFeedbackMessage}
          onInscribeChosenCsvText={inscribeGamesLedgerFromCsvText}
        />
        <StaffCsvLedgerUpload
          ledgerHeading="Roster ledger"
          ledgerDescription="Upload a CSV with display_name and is_staff. Rows upsert by name. Names missing from the sheet are deleted, or kept when a ballot already exists."
          csvFileInputName="rosterCsv"
          csvFileInputLabelText="Roster CSV"
          chooseCsvButtonLabel="Choose roster CSV"
          inscribeLedgerButtonLabel="Inscribe the roster ledger"
          isInscribingLedger={isInscribingRosterLedger}
          ledgerFeedbackMessage={rosterLedgerFeedbackMessage}
          onInscribeChosenCsvText={inscribeRosterLedgerFromCsvText}
        />
        <ParchmentCard>
          <HeadingDisplay headingLevel={2} inkTone="parchment">
            Sealed ballot results
          </HeadingDisplay>
          {resultsLoadState === "loading" ? (
            <p>The heralds are fetching the sealed results…</p>
          ) : null}
          {resultsLoadState === "failed" ? (
            <>
              <p>{resultsFailureMessage}</p>
              <GoldButton
                variant="secondary"
                onClick={() => {
                  void summonLockedBallotResults();
                }}
              >
                Summon the results again
              </GoldButton>
            </>
          ) : null}
          {resultsLoadState === "ready" && lockedBallotResults ? (
            <StaffResultsBoard lockedBallotResults={lockedBallotResults} />
          ) : null}
        </ParchmentCard>
      </div>
    </PageShell>
  );
}

function StaffResultsBoard({
  lockedBallotResults,
}: {
  lockedBallotResults: StaffLockedBallotResults;
}) {
  return (
    <>
      <p>{describeLockedBallotCount(lockedBallotResults.lockedBallotCount)}</p>
      {lockedBallotResults.categories.map((categoryStandings) => (
        <div key={categoryStandings.category}>
          <HeadingDisplay headingLevel={3} inkTone="parchment">
            {AWARD_CATEGORY_DISPLAY_NAMES[categoryStandings.category]}
          </HeadingDisplay>
          {categoryStandings.standings.length === 0 ? (
            <p>{noSealedVotesInThisHallMessage}</p>
          ) : (
            <div className={styles.resultsStandingsList}>
              {categoryStandings.standings.map((standing) => (
                <StaffResultsStandingRow
                  key={`${categoryStandings.category}-${standing.game.gameId}`}
                  standing={standing}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function StaffResultsStandingRow({
  standing,
}: {
  standing: StaffResultsStanding;
}) {
  const standingIsAWinner = standing.rank === 1;

  return (
    <div className={styles.resultsStandingRow}>
      <p>{describeStaffResultsStandingCaption(standing)}</p>
      <GamePortraitCard
        gameTitle={standing.game.title}
        submitterName={standing.game.submitterName}
        gameUrl={standing.game.url}
        isSelected={standingIsAWinner}
      />
    </div>
  );
}

function describeStaffKeepFailure(error: unknown): string {
  if (error instanceof VotingApiRequestFailedError) {
    return error.message;
  }

  return "The staff keep could not complete that request.";
}
