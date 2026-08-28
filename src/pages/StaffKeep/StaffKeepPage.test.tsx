import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VotingApiRequestFailedError } from "../../api/VotingApiRequestFailedError";
import type { HonorSystemSession } from "../../api/votingApiTypes";
import { createVotingApiClientMock } from "../../test/createVotingApiClientMock";
import {
  staffLockedBallotResults,
  successfulGamesCsvImportSummary,
  successfulVoterRosterCsvImportSummary,
} from "../../test/staffKeepTestFixtures";
import staffCsvLedgerUploadSource from "./StaffCsvLedgerUpload.tsx?raw";
import { StaffKeepPage } from "./StaffKeepPage";
import staffKeepPageSource from "./StaffKeepPage.tsx?raw";

const staffSageHonorSystemSession: HonorSystemSession = {
  token: "staff-token",
  voterId: "22222222-2222-2222-2222-222222222222",
  displayName: "Staff Sage",
  isStaff: true,
};

const gamesCsvRowErrorMessage =
  "Games CSV row 2 has a blank title, submitter_name, or url";
const rosterCsvRowErrorMessage =
  "Voter roster CSV row 2 has a blank display_name";

describe("StaffKeepPage", () => {
  it("reuses only the locked design-system primitives", () => {
    const staffKeepSources = `${staffKeepPageSource}\n${staffCsvLedgerUploadSource}`;

    expect(staffKeepSources).toContain("PageShell");
    expect(staffKeepSources).toContain("ParchmentCard");
    expect(staffKeepSources).toContain("GoldButton");
    expect(staffKeepSources).toContain("HeadingDisplay");
    expect(staffKeepSources).toContain("GamePortraitCard");
    expect(staffKeepPageSource).toMatch(
      /from ["']\.\.\/\.\.\/design-system["']/,
    );
    expect(staffCsvLedgerUploadSource).toMatch(
      /from ["']\.\.\/\.\.\/design-system["']/,
    );
    expect(staffKeepSources).not.toMatch(/<select\b/);
    expect(staffKeepSources).not.toContain("StoneInput");
  });

  it("shows games and roster CSV ledgers plus sealed results for a staff session", async () => {
    const votingApiClient = createVotingApiClientMock();

    render(
      <StaffKeepPage
        votingApiClient={votingApiClient}
        honorSystemSession={staffSageHonorSystemSession}
        onReturnToNameGate={vi.fn()}
        onOpenHeraldryGallery={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Staff keep" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Games ledger" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Roster ledger" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Sealed ballot results" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("2 sealed ballots have been counted."),
    ).toBeInTheDocument();
    expect(votingApiClient.fetchLockedBallotResultsForStaff).toHaveBeenCalledWith(
      { sessionToken: "staff-token" },
    );
  });

  it("renders vote counts and winners per award category, including ties and empty halls", async () => {
    const votingApiClient = createVotingApiClientMock();

    render(
      <StaffKeepPage
        votingApiClient={votingApiClient}
        honorSystemSession={staffSageHonorSystemSession}
        onReturnToNameGate={vi.fn()}
        onOpenHeraldryGallery={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Technical Achievement" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Rank 1 · 2 votes · Winner")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: /Dungeon Crawler/ }),
    ).toHaveAttribute("aria-pressed", "true");

    expect(
      screen.getByRole("heading", { name: "Most Creative/Fun Gameplay" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Rank 1 · 1 vote · Tied winner"),
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: /Lanterns of Qeynos/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /Rift of the Hollow King/ }),
    ).toHaveAttribute("aria-pressed", "true");

    expect(
      screen.getByRole("heading", { name: "Best Visuals/Graphics" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No sealed votes have been tallied in this hall yet."),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Best Overall" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Storms over Karana/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(staffLockedBallotResults.lockedBallotCount).toBe(2);
  });

  it("shows games CSV row-error feedback from the import API", async () => {
    const user = userEvent.setup();
    const gamesCsvText =
      "title,submitter_name,url\n,,https://example.com/blank";
    const votingApiClient = createVotingApiClientMock({
      importGamesFromCsvText: vi.fn(async () => {
        throw new VotingApiRequestFailedError({
          failureKind: "http",
          httpStatusCode: 400,
          message: gamesCsvRowErrorMessage,
        });
      }),
    });

    render(
      <StaffKeepPage
        votingApiClient={votingApiClient}
        honorSystemSession={staffSageHonorSystemSession}
        onReturnToNameGate={vi.fn()}
        onOpenHeraldryGallery={vi.fn()}
      />,
    );

    await user.upload(
      screen.getByLabelText("Games CSV"),
      new File([gamesCsvText], "games.csv", { type: "text/csv" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Inscribe the games ledger" }),
    );

    expect(await screen.findByText(gamesCsvRowErrorMessage)).toBeInTheDocument();
    expect(votingApiClient.importGamesFromCsvText).toHaveBeenCalledWith({
      sessionToken: "staff-token",
      csvText: gamesCsvText,
    });
  });

  it("shows roster CSV row-error feedback from the import API", async () => {
    const user = userEvent.setup();
    const rosterCsvText = "display_name,is_staff\n,true";
    const votingApiClient = createVotingApiClientMock({
      importVoterRosterFromCsvText: vi.fn(async () => {
        throw new VotingApiRequestFailedError({
          failureKind: "http",
          httpStatusCode: 400,
          message: rosterCsvRowErrorMessage,
        });
      }),
    });

    render(
      <StaffKeepPage
        votingApiClient={votingApiClient}
        honorSystemSession={staffSageHonorSystemSession}
        onReturnToNameGate={vi.fn()}
        onOpenHeraldryGallery={vi.fn()}
      />,
    );

    await user.upload(
      screen.getByLabelText("Roster CSV"),
      new File([rosterCsvText], "voters.csv", { type: "text/csv" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Inscribe the roster ledger" }),
    );

    expect(
      await screen.findByText(rosterCsvRowErrorMessage),
    ).toBeInTheDocument();
    expect(votingApiClient.importVoterRosterFromCsvText).toHaveBeenCalledWith({
      sessionToken: "staff-token",
      csvText: rosterCsvText,
    });
  });

  it("reports a successful games ledger inscription with upsert, delete, and withdraw counts", async () => {
    const user = userEvent.setup();
    const gamesCsvText = [
      "title,submitter_name,url",
      "Dungeon Crawler,Ada Lovelace,https://example.com/dungeon",
    ].join("\n");
    const votingApiClient = createVotingApiClientMock();

    render(
      <StaffKeepPage
        votingApiClient={votingApiClient}
        honorSystemSession={staffSageHonorSystemSession}
        onReturnToNameGate={vi.fn()}
        onOpenHeraldryGallery={vi.fn()}
      />,
    );

    await user.upload(
      screen.getByLabelText("Games CSV"),
      new File([gamesCsvText], "games.csv", { type: "text/csv" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Inscribe the games ledger" }),
    );

    expect(
      await screen.findByText(
        "The games ledger accepted 2 rows (1 deleted, 0 withdrawn for existing votes).",
      ),
    ).toBeInTheDocument();
    expect(votingApiClient.importGamesFromCsvText).toHaveBeenCalledWith({
      sessionToken: "staff-token",
      csvText: gamesCsvText,
    });
    expect(successfulGamesCsvImportSummary.upserted).toBe(2);
  });

  it("reports a successful roster ledger inscription with kept-because-ballot counts", async () => {
    const user = userEvent.setup();
    const rosterCsvText = [
      "display_name,is_staff",
      "Ada Lovelace,false",
      "Staff Sage,true",
    ].join("\n");
    const votingApiClient = createVotingApiClientMock();

    render(
      <StaffKeepPage
        votingApiClient={votingApiClient}
        honorSystemSession={staffSageHonorSystemSession}
        onReturnToNameGate={vi.fn()}
        onOpenHeraldryGallery={vi.fn()}
      />,
    );

    await user.upload(
      screen.getByLabelText("Roster CSV"),
      new File([rosterCsvText], "voters.csv", { type: "text/csv" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Inscribe the roster ledger" }),
    );

    expect(
      await screen.findByText(
        "The roster ledger accepted 3 names (1 deleted, 1 kept because a ballot exists).",
      ),
    ).toBeInTheDocument();
    expect(successfulVoterRosterCsvImportSummary.keptBecauseBallotExists).toBe(
      1,
    );
  });

  it("keeps the inscribe buttons disabled until a CSV scroll is chosen", async () => {
    render(
      <StaffKeepPage
        votingApiClient={createVotingApiClientMock()}
        honorSystemSession={staffSageHonorSystemSession}
        onReturnToNameGate={vi.fn()}
        onOpenHeraldryGallery={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Inscribe the games ledger" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Inscribe the roster ledger" }),
    ).toBeDisabled();
    await waitFor(() => {
      expect(
        screen.getByText("2 sealed ballots have been counted."),
      ).toBeInTheDocument();
    });
  });
});
