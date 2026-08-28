import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VotingApiRequestFailedError } from "../../api/VotingApiRequestFailedError";
import type { HonorSystemSession } from "../../api/votingApiTypes";
import { createVotingApiClientMock } from "../../test/createVotingApiClientMock";
import { completeUnlockedVoterBallot, sealedVoterBallot } from "../../test/votingHallTestFixtures";
import { VotingHallPage } from "./VotingHallPage";
import votingHallPageSource from "./VotingHallPage.tsx?raw";

const adaLovelaceHonorSystemSession: HonorSystemSession = {
  token: "voter-token",
  voterId: "11111111-1111-1111-1111-111111111111",
  displayName: "Ada Lovelace",
  isStaff: false,
};

describe("VotingHallPage", () => {
  it("reuses only the locked design-system primitives and never a raw dropdown", () => {
    expect(votingHallPageSource).toContain("PageShell");
    expect(votingHallPageSource).toContain("ParchmentCard");
    expect(votingHallPageSource).toContain("GoldButton");
    expect(votingHallPageSource).toContain("StoneInput");
    expect(votingHallPageSource).toContain("HeadingDisplay");
    expect(votingHallPageSource).toContain("GamePortraitCard");
    expect(votingHallPageSource).toMatch(
      /from ["']\.\.\/\.\.\/design-system["']/,
    );
    expect(votingHallPageSource).not.toMatch(/<select\b/);
    expect(votingHallPageSource).not.toMatch(/<option\b/);
  });

  it("presents games as character-select portraits for all four award halls", async () => {
    const votingApiClient = createVotingApiClientMock();

    render(
      <VotingHallPage
        votingApiClient={votingApiClient}
        honorSystemSession={adaLovelaceHonorSystemSession}
        onReturnToNameGate={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Four Banners of the Contest" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tablist", { name: "Award categories" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Technical Achievement" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Most Creative/Fun Gameplay" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Best Visuals/Graphics" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Best Overall" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Dungeon Crawler/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Lanterns of Qeynos/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(votingApiClient.fetchGamesListedOnTheBallot).toHaveBeenCalledWith({
      sessionToken: "voter-token",
    });
    expect(votingApiClient.fetchBallotForCurrentVoter).toHaveBeenCalledWith({
      sessionToken: "voter-token",
    });
  });

  it("blocks lock-in review until every hall has a champion", async () => {
    const user = userEvent.setup();
    const votingApiClient = createVotingApiClientMock();

    render(
      <VotingHallPage
        votingApiClient={votingApiClient}
        honorSystemSession={adaLovelaceHonorSystemSession}
        onReturnToNameGate={vi.fn()}
      />,
    );

    await screen.findByRole("button", { name: /Dungeon Crawler/ });
    expect(screen.getByRole("button", { name: "Review lock-in" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Dungeon Crawler/ }));
    expect(screen.getByRole("button", { name: "Review lock-in" })).toBeDisabled();
    expect(
      votingApiClient.lockCompletedBallotForCurrentVoter,
    ).not.toHaveBeenCalled();
  });

  it("PUTs the draft on each portrait pick, then confirms lock-in before POST /ballot/lock", async () => {
    const user = userEvent.setup();
    const votingApiClient = createVotingApiClientMock();

    render(
      <VotingHallPage
        votingApiClient={votingApiClient}
        honorSystemSession={adaLovelaceHonorSystemSession}
        onReturnToNameGate={vi.fn()}
      />,
    );

    await pickOneChampionInEachHall(user);

    await waitFor(() => {
      expect(
        votingApiClient.replaceUnlockedDraftBallotVotes,
      ).toHaveBeenCalledTimes(4);
    });
    expect(
      votingApiClient.replaceUnlockedDraftBallotVotes,
    ).toHaveBeenLastCalledWith({
      sessionToken: "voter-token",
      votes: completeUnlockedVoterBallot.votes,
    });
    expect(
      votingApiClient.lockCompletedBallotForCurrentVoter,
    ).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Review lock-in" }));

    expect(
      await screen.findByRole("heading", {
        name: "Seal these four banners?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Technical Achievement" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Dungeon Crawler/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      votingApiClient.lockCompletedBallotForCurrentVoter,
    ).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Lock in these champions" }),
    );

    await waitFor(() => {
      expect(
        votingApiClient.lockCompletedBallotForCurrentVoter,
      ).toHaveBeenCalledWith({
        sessionToken: "voter-token",
      });
    });
    expect(
      await screen.findByRole("heading", { name: "Your ballot is sealed" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Review lock-in" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Lock in these champions" }),
    ).not.toBeInTheDocument();
  });

  it("keeps a sealed ballot read-only so portraits cannot PUT after lock", async () => {
    const user = userEvent.setup();
    const votingApiClient = createVotingApiClientMock({
      fetchBallotForCurrentVoter: vi.fn(async () => sealedVoterBallot),
    });

    render(
      <VotingHallPage
        votingApiClient={votingApiClient}
        honorSystemSession={adaLovelaceHonorSystemSession}
        onReturnToNameGate={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Your ballot is sealed" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Seek a game")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Review lock-in" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Dungeon Crawler/ }));
    expect(
      votingApiClient.replaceUnlockedDraftBallotVotes,
    ).not.toHaveBeenCalled();
    expect(
      votingApiClient.lockCompletedBallotForCurrentVoter,
    ).not.toHaveBeenCalled();
  });

  it("surfaces the incomplete-lock refusal if POST /ballot/lock returns 400", async () => {
    const user = userEvent.setup();
    const votingApiClient = createVotingApiClientMock({
      lockCompletedBallotForCurrentVoter: vi.fn(async () => {
        throw new VotingApiRequestFailedError({
          failureKind: "http",
          httpStatusCode: 400,
          message:
            "Locking a ballot requires one real non-withdrawn game in each of the four award categories",
        });
      }),
    });

    render(
      <VotingHallPage
        votingApiClient={votingApiClient}
        honorSystemSession={adaLovelaceHonorSystemSession}
        onReturnToNameGate={vi.fn()}
      />,
    );

    await pickOneChampionInEachHall(user);
    await user.click(screen.getByRole("button", { name: "Review lock-in" }));
    await user.click(
      screen.getByRole("button", { name: "Lock in these champions" }),
    );

    expect(
      await screen.findByText(
        "Lock-in requires one champion in each of the four halls.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Seal these four banners?" }),
    ).toBeInTheDocument();
  });

  it("lets a voter seek a game without leaving the portrait picker", async () => {
    const user = userEvent.setup();

    render(
      <VotingHallPage
        votingApiClient={createVotingApiClientMock()}
        honorSystemSession={adaLovelaceHonorSystemSession}
        onReturnToNameGate={vi.fn()}
      />,
    );

    await screen.findByRole("button", { name: /Dungeon Crawler/ });
    await user.type(screen.getByLabelText("Seek a game"), "Lanterns");

    expect(
      screen.getByRole("button", { name: /Lanterns of Qeynos/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Dungeon Crawler/ }),
    ).not.toBeInTheDocument();
  });
});

async function pickOneChampionInEachHall(
  user: ReturnType<typeof userEvent.setup>,
) {
  await screen.findByRole("button", { name: /Dungeon Crawler/ });
  await user.click(screen.getByRole("button", { name: /Dungeon Crawler/ }));

  await user.click(
    screen.getByRole("button", { name: "Most Creative/Fun Gameplay" }),
  );
  await user.click(screen.getByRole("button", { name: /Lanterns of Qeynos/ }));

  await user.click(screen.getByRole("button", { name: "Best Visuals/Graphics" }));
  await user.click(
    screen.getByRole("button", { name: /Rift of the Hollow King/ }),
  );

  await user.click(screen.getByRole("button", { name: "Best Overall" }));
  await user.click(screen.getByRole("button", { name: /Storms over Karana/ }));
}
