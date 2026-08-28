import { useCallback, useEffect, useRef, useState } from "react";
import { VotingApiRequestFailedError } from "../../api/VotingApiRequestFailedError";
import type {
  GameListedOnTheBallot,
  HonorSystemSession,
  VotingApiClient,
} from "../../api/votingApiTypes";
import {
  AWARD_CATEGORIES,
  AWARD_CATEGORY_DISPLAY_NAMES,
  type AwardCategory,
} from "../../awards/awardCategories";
import {
  areDraftBallotVoteListsEqual,
  collectDraftBallotVotesFromSelectedGameIds,
  countFilledAwardCategories,
  isEveryAwardCategoryFilled,
  readSelectedGameIdByAwardCategoryFromBallotVotes,
  type SelectedGameIdByAwardCategory,
} from "../../ballots/draftBallotSelections";
import {
  GamePortraitCard,
  GoldButton,
  HeadingDisplay,
  PageShell,
  ParchmentCard,
  StoneInput,
} from "../../design-system";
import styles from "./VotingHallPage.module.css";

type VotingHallView = "draft" | "lockInReview" | "sealed";

type VotingHallPageProperties = {
  votingApiClient: VotingApiClient;
  honorSystemSession: HonorSystemSession;
  onReturnToNameGate: () => void;
};

export function VotingHallPage({
  votingApiClient,
  honorSystemSession,
  onReturnToNameGate,
}: VotingHallPageProperties) {
  const [hallLoadState, setHallLoadState] = useState<
    "loading" | "ready" | "failed"
  >("loading");
  const [hallFailureMessage, setHallFailureMessage] = useState<
    string | undefined
  >(undefined);
  const [gamesListedOnTheBallot, setGamesListedOnTheBallot] = useState<
    GameListedOnTheBallot[]
  >([]);
  const [selectedGameIdByAwardCategory, setSelectedGameIdByAwardCategory] =
    useState<SelectedGameIdByAwardCategory>({});
  const [activeAwardCategory, setActiveAwardCategory] = useState<AwardCategory>(
    AWARD_CATEGORIES[0],
  );
  const [gameSeekQuery, setGameSeekQuery] = useState("");
  const [votingHallView, setVotingHallView] = useState<VotingHallView>("draft");
  const [draftSaveFailureMessage, setDraftSaveFailureMessage] = useState<
    string | undefined
  >(undefined);
  const [lockFailureMessage, setLockFailureMessage] = useState<
    string | undefined
  >(undefined);
  const [isSealingBallot, setIsSealingBallot] = useState(false);

  const selectedGameIdByAwardCategoryRef = useRef(selectedGameIdByAwardCategory);
  selectedGameIdByAwardCategoryRef.current = selectedGameIdByAwardCategory;

  const summonGamesAndBallot = useCallback(async () => {
    setHallLoadState("loading");
    setHallFailureMessage(undefined);
    setDraftSaveFailureMessage(undefined);
    setLockFailureMessage(undefined);

    try {
      const [games, ballot] = await Promise.all([
        votingApiClient.fetchGamesListedOnTheBallot({
          sessionToken: honorSystemSession.token,
        }),
        votingApiClient.fetchBallotForCurrentVoter({
          sessionToken: honorSystemSession.token,
        }),
      ]);

      setGamesListedOnTheBallot(games);
      const restoredSelection =
        readSelectedGameIdByAwardCategoryFromBallotVotes(ballot.votes);
      selectedGameIdByAwardCategoryRef.current = restoredSelection;
      setSelectedGameIdByAwardCategory(restoredSelection);
      setVotingHallView(ballot.isLocked ? "sealed" : "draft");
      setHallLoadState("ready");
    } catch (error: unknown) {
      setGamesListedOnTheBallot([]);
      setSelectedGameIdByAwardCategory({});
      selectedGameIdByAwardCategoryRef.current = {};
      setHallLoadState("failed");
      setHallFailureMessage(describeHallSummonFailure(error));
    }
  }, [honorSystemSession.token, votingApiClient]);

  useEffect(() => {
    void summonGamesAndBallot();
  }, [summonGamesAndBallot]);

  async function chooseGameForAwardCategory(
    awardCategory: AwardCategory,
    gameId: string,
  ) {
    if (votingHallView !== "draft") {
      return;
    }

    const nextSelection = {
      ...selectedGameIdByAwardCategoryRef.current,
      [awardCategory]: gameId,
    };
    selectedGameIdByAwardCategoryRef.current = nextSelection;
    setSelectedGameIdByAwardCategory(nextSelection);
    setDraftSaveFailureMessage(undefined);

    try {
      const ballot = await votingApiClient.replaceUnlockedDraftBallotVotes({
        sessionToken: honorSystemSession.token,
        votes: collectDraftBallotVotesFromSelectedGameIds(nextSelection),
      });
      const thisRequestIsStillTheLatestDraft = areDraftBallotVoteListsEqual(
        collectDraftBallotVotesFromSelectedGameIds(
          selectedGameIdByAwardCategoryRef.current,
        ),
        collectDraftBallotVotesFromSelectedGameIds(nextSelection),
      );

      if (ballot.isLocked) {
        const restoredSelection =
          readSelectedGameIdByAwardCategoryFromBallotVotes(ballot.votes);
        selectedGameIdByAwardCategoryRef.current = restoredSelection;
        setSelectedGameIdByAwardCategory(restoredSelection);
        setVotingHallView("sealed");
        return;
      }

      if (!thisRequestIsStillTheLatestDraft) {
        return;
      }

      const restoredSelection =
        readSelectedGameIdByAwardCategoryFromBallotVotes(ballot.votes);
      selectedGameIdByAwardCategoryRef.current = restoredSelection;
      setSelectedGameIdByAwardCategory(restoredSelection);
    } catch (error: unknown) {
      setDraftSaveFailureMessage(describeDraftSaveFailure(error));
      if (
        error instanceof VotingApiRequestFailedError &&
        error.httpStatusCode === 409
      ) {
        setVotingHallView("sealed");
      }
    }
  }

  function openLockInReview() {
    if (!isEveryAwardCategoryFilled(selectedGameIdByAwardCategory)) {
      return;
    }

    setLockFailureMessage(undefined);
    setVotingHallView("lockInReview");
  }

  function returnToDraftPicker() {
    if (votingHallView === "sealed") {
      return;
    }

    setVotingHallView("draft");
  }

  async function sealTheCompletedBallot() {
    if (
      !isEveryAwardCategoryFilled(selectedGameIdByAwardCategory) ||
      isSealingBallot
    ) {
      return;
    }

    setIsSealingBallot(true);
    setLockFailureMessage(undefined);

    try {
      const ballot = await votingApiClient.lockCompletedBallotForCurrentVoter({
        sessionToken: honorSystemSession.token,
      });
      const restoredSelection =
        readSelectedGameIdByAwardCategoryFromBallotVotes(ballot.votes);
      selectedGameIdByAwardCategoryRef.current = restoredSelection;
      setSelectedGameIdByAwardCategory(restoredSelection);
      setVotingHallView("sealed");
    } catch (error: unknown) {
      setLockFailureMessage(describeLockFailure(error));
      setIsSealingBallot(false);
    }
  }

  const filledAwardCategoryCount = countFilledAwardCategories(
    selectedGameIdByAwardCategory,
  );
  const everyAwardCategoryIsFilled = isEveryAwardCategoryFilled(
    selectedGameIdByAwardCategory,
  );
  const gamesVisibleInTheActiveHall = gamesMatchingSeekQuery(
    gamesListedOnTheBallot,
    gameSeekQuery,
  );
  const selectedGameForActiveHall = findGameListedOnTheBallotById(
    gamesListedOnTheBallot,
    selectedGameIdByAwardCategory[activeAwardCategory],
  );

  return (
    <PageShell>
      <div className={styles.votingHallLayout}>
        <HeadingDisplay>Champion's keep</HeadingDisplay>
        <ParchmentCard>
          <HeadingDisplay headingLevel={2} inkTone="parchment">
            Four Banners of the Contest
          </HeadingDisplay>
          <p>
            Welcome, {honorSystemSession.displayName}. Browse the submitted
            games as you would a character select. Raise one champion in each
            hall, then seal the ballot. The seal cannot be broken.
          </p>
          <div className={styles.hallActions}>
            <GoldButton variant="secondary" onClick={onReturnToNameGate}>
              Return to the name gate
            </GoldButton>
          </div>
        </ParchmentCard>
        {hallLoadState === "loading" ? (
          <ParchmentCard>
            <p>The heralds are fetching the games…</p>
          </ParchmentCard>
        ) : null}
        {hallLoadState === "failed" ? (
          <ParchmentCard>
            <p>{hallFailureMessage}</p>
            <GoldButton
              variant="secondary"
              onClick={() => {
                void summonGamesAndBallot();
              }}
            >
              Summon the games again
            </GoldButton>
          </ParchmentCard>
        ) : null}
        {hallLoadState === "ready" && votingHallView === "draft" ? (
          <ParchmentCard>
            <HeadingDisplay headingLevel={2} inkTone="parchment">
              {AWARD_CATEGORY_DISPLAY_NAMES[activeAwardCategory]}
            </HeadingDisplay>
            <p>
              {filledAwardCategoryCount} of {AWARD_CATEGORIES.length} halls have
              a champion.
              {selectedGameForActiveHall
                ? ` Current champion: ${selectedGameForActiveHall.title}.`
                : " This hall has no champion yet."}
            </p>
            <div
              className={styles.categoryBannerList}
              role="tablist"
              aria-label="Award categories"
            >
              {AWARD_CATEGORIES.map((awardCategory) => {
                const isActiveAwardCategory =
                  awardCategory === activeAwardCategory;
                const selectedGameId =
                  selectedGameIdByAwardCategory[awardCategory];

                return (
                  <div
                    key={awardCategory}
                    role="tab"
                    aria-selected={isActiveAwardCategory}
                  >
                    <GoldButton
                      variant={isActiveAwardCategory ? "primary" : "secondary"}
                      onClick={() => {
                        setActiveAwardCategory(awardCategory);
                      }}
                    >
                      {selectedGameId
                        ? `${AWARD_CATEGORY_DISPLAY_NAMES[awardCategory]} claimed`
                        : AWARD_CATEGORY_DISPLAY_NAMES[awardCategory]}
                    </GoldButton>
                  </div>
                );
              })}
            </div>
            <div className={styles.seekField}>
              <StoneInput
                labelText="Seek a game"
                inputName="gameSeek"
                value={gameSeekQuery}
                onValueChange={setGameSeekQuery}
                placeholderText="Title or submitter"
              />
            </div>
            {gamesListedOnTheBallot.length === 0 ? (
              <p>The halls have no games to champion.</p>
            ) : null}
            {gamesListedOnTheBallot.length > 0 &&
            gamesVisibleInTheActiveHall.length === 0 ? (
              <p>No games match that seek.</p>
            ) : null}
            <div className={styles.portraitGrid}>
              {gamesVisibleInTheActiveHall.map((game) => (
                <GamePortraitCard
                  key={game.gameId}
                  gameTitle={game.title}
                  submitterName={game.submitterName}
                  gameUrl={game.url}
                  isSelected={
                    selectedGameIdByAwardCategory[activeAwardCategory] ===
                    game.gameId
                  }
                  onSelectPortrait={() => {
                    void chooseGameForAwardCategory(
                      activeAwardCategory,
                      game.gameId,
                    );
                  }}
                />
              ))}
            </div>
            {draftSaveFailureMessage ? <p>{draftSaveFailureMessage}</p> : null}
            <div className={styles.hallActions}>
              <GoldButton
                isDisabled={!everyAwardCategoryIsFilled}
                onClick={openLockInReview}
              >
                Review lock-in
              </GoldButton>
            </div>
          </ParchmentCard>
        ) : null}
        {hallLoadState === "ready" && votingHallView === "lockInReview" ? (
          <ParchmentCard>
            <HeadingDisplay headingLevel={2} inkTone="parchment">
              Seal these four banners?
            </HeadingDisplay>
            <p>
              Look over your champions. Once you lock in, this ballot becomes
              read-only and cannot be recast.
            </p>
            <LockedOrReviewingBannerSelections
              gamesListedOnTheBallot={gamesListedOnTheBallot}
              selectedGameIdByAwardCategory={selectedGameIdByAwardCategory}
            />
            {lockFailureMessage ? <p>{lockFailureMessage}</p> : null}
            <div className={styles.hallActions}>
              <GoldButton
                isDisabled={!everyAwardCategoryIsFilled || isSealingBallot}
                onClick={() => {
                  void sealTheCompletedBallot();
                }}
              >
                Lock in these champions
              </GoldButton>
              <GoldButton
                variant="secondary"
                isDisabled={isSealingBallot}
                onClick={returnToDraftPicker}
              >
                Return to the halls
              </GoldButton>
            </div>
          </ParchmentCard>
        ) : null}
        {hallLoadState === "ready" && votingHallView === "sealed" ? (
          <ParchmentCard>
            <HeadingDisplay headingLevel={2} inkTone="parchment">
              Your ballot is sealed
            </HeadingDisplay>
            <p>
              These four banners are locked. The vote cannot be recast.
            </p>
            <LockedOrReviewingBannerSelections
              gamesListedOnTheBallot={gamesListedOnTheBallot}
              selectedGameIdByAwardCategory={selectedGameIdByAwardCategory}
            />
          </ParchmentCard>
        ) : null}
      </div>
    </PageShell>
  );
}

function LockedOrReviewingBannerSelections({
  gamesListedOnTheBallot,
  selectedGameIdByAwardCategory,
}: {
  gamesListedOnTheBallot: GameListedOnTheBallot[];
  selectedGameIdByAwardCategory: SelectedGameIdByAwardCategory;
}) {
  return (
    <div className={styles.lockInSelections}>
      {AWARD_CATEGORIES.map((awardCategory) => {
        const selectedGame = findGameListedOnTheBallotById(
          gamesListedOnTheBallot,
          selectedGameIdByAwardCategory[awardCategory],
        );

        return (
          <div key={awardCategory}>
            <HeadingDisplay headingLevel={3} inkTone="parchment">
              {AWARD_CATEGORY_DISPLAY_NAMES[awardCategory]}
            </HeadingDisplay>
            {selectedGame ? (
              <GamePortraitCard
                gameTitle={selectedGame.title}
                submitterName={selectedGame.submitterName}
                gameUrl={selectedGame.url}
                isSelected
              />
            ) : (
              <p>No champion chosen for this hall.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function findGameListedOnTheBallotById(
  games: GameListedOnTheBallot[],
  gameId: string | undefined,
): GameListedOnTheBallot | undefined {
  if (gameId === undefined) {
    return undefined;
  }

  return games.find((game) => game.gameId === gameId);
}

function gamesMatchingSeekQuery(
  games: GameListedOnTheBallot[],
  seekQuery: string,
): GameListedOnTheBallot[] {
  const normalizedSeekQuery = seekQuery.trim().toLowerCase();
  if (normalizedSeekQuery.length === 0) {
    return games;
  }

  return games.filter((game) => {
    return (
      game.title.toLowerCase().includes(normalizedSeekQuery) ||
      game.submitterName.toLowerCase().includes(normalizedSeekQuery)
    );
  });
}

function describeHallSummonFailure(error: unknown): string {
  if (error instanceof VotingApiRequestFailedError) {
    return error.message;
  }

  return "The games could not be summoned.";
}

function describeDraftSaveFailure(error: unknown): string {
  if (error instanceof VotingApiRequestFailedError) {
    if (error.httpStatusCode === 409) {
      return "This ballot is already sealed and cannot be changed.";
    }

    return error.message;
  }

  return "The ballot draft could not be saved.";
}

function describeLockFailure(error: unknown): string {
  if (error instanceof VotingApiRequestFailedError) {
    if (error.httpStatusCode === 400) {
      return "Lock-in requires one champion in each of the four halls.";
    }

    if (error.httpStatusCode === 409) {
      return "This ballot is already sealed and cannot be changed.";
    }

    return error.message;
  }

  return "The ballot could not be sealed.";
}
